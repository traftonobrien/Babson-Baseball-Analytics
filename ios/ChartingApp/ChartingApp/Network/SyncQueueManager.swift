import Foundation
import SwiftData

/// Represents the background sync state for the active game.
enum SyncStatus: Equatable {
    case synced
    case syncing
    case pending
    case failed(String)
}

/// A background actor responsible for pushing the local game snapshot to the API.
///
/// Entries are persisted to SwiftData so that unsent snapshots survive app kills
/// and are automatically retried on next launch. The flow:
///   1. `enqueueSync(...)` → saves a `PersistedSyncEntry` → debounces → performs sync
///   2. On success → deletes the entry
///   3. On failure → increments `retryCount`, marks as "failed"
///   4. `drainPendingEntries()` → retries all pending/failed entries (called on app launch)
actor SyncQueueManager {

    private let apiClient: APIClient
    private let modelContainer: ModelContainer
    private var syncTask: Task<Void, Never>?
    private var isSyncing = false

    /// Max retries before giving up on an entry.
    private let maxRetries = 5

    /// Called when status changes, allowing the UI to react via MainActor.
    private var onStatusChange: (@Sendable (SyncStatus) -> Void)?

    func setOnStatusChange(_ handler: @Sendable @escaping (SyncStatus) -> Void) {
        self.onStatusChange = handler
    }

    init(apiClient: APIClient, modelContainer: ModelContainer) {
        self.apiClient = apiClient
        self.modelContainer = modelContainer
    }

    /// Debounces requests and enqueues a sync operation for the given game snapshot payload.
    /// The payload is persisted to SwiftData before attempting the network call.
    func enqueueSync(
        gameId: String,
        revision: Int,
        payload: ChartingGameSnapshot,
        delaySeconds: Double = 2.0
    ) {
        // Cancel any pending debounce that hasn't fired yet
        syncTask?.cancel()

        onStatusChange?(.pending)

        // Persist the entry first — this survives app kills
        persistEntry(gameId: gameId, revision: revision, payload: payload)

        // Start a debounced task
        syncTask = Task {
            do {
                try await Task.sleep(for: .seconds(delaySeconds))
                if Task.isCancelled { return }

                await performSync(gameId: gameId, revision: revision, payload: payload)
            } catch {
                // Sleep cancellation throws CancellationError — that's fine
            }
        }
    }

    /// Retry all pending/failed entries from SwiftData (call on app launch).
    func drainPendingEntries() async {
        let context = ModelContext(modelContainer)
        let descriptor = FetchDescriptor<PersistedSyncEntry>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )

        guard let entries = try? context.fetch(descriptor), !entries.isEmpty else { return }

        for entry in entries {
            guard entry.retryCount < maxRetries else {
                // Too many retries — remove stale entry
                context.delete(entry)
                try? context.save()
                continue
            }

            // Decode the payload
            guard let payload = try? JSONDecoder().decode(ChartingGameSnapshot.self, from: entry.payloadJSON) else {
                context.delete(entry)
                try? context.save()
                continue
            }

            entry.status = "syncing"
            try? context.save()

            await performSync(
                gameId: entry.gameId,
                revision: entry.revision,
                payload: payload,
                entryId: entry.id
            )
        }
    }

    // MARK: - Private

    /// Persist a sync entry to SwiftData.
    private func persistEntry(gameId: String, revision: Int, payload: ChartingGameSnapshot) {
        let context = ModelContext(modelContainer)

        // Remove any existing entries for this game (we only care about the latest snapshot)
        let existingDescriptor = FetchDescriptor<PersistedSyncEntry>(
            predicate: #Predicate { $0.gameId == gameId }
        )
        if let existing = try? context.fetch(existingDescriptor) {
            for entry in existing {
                context.delete(entry)
            }
        }

        // Insert new entry
        guard let data = try? JSONEncoder().encode(payload) else { return }
        let entry = PersistedSyncEntry(
            gameId: gameId,
            revision: revision,
            payloadJSON: data
        )
        context.insert(entry)
        try? context.save()
    }

    /// Perform the actual network request. On success, removes the persisted entry.
    private func performSync(
        gameId: String,
        revision: Int,
        payload: ChartingGameSnapshot,
        entryId: String? = nil
    ) async {
        guard !isSyncing else { return }
        isSyncing = true
        onStatusChange?(.syncing)

        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(payload)
            guard let fields = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                throw URLError(.badServerResponse)
            }

            let _ = try await apiClient.updateGame(id: gameId, revision: revision, fields: fields)

            if !Task.isCancelled {
                onStatusChange?(.synced)
            }

            // Success — remove the persisted entry
            removeEntry(gameId: gameId, entryId: entryId)
        } catch let error as APIError {
            if !Task.isCancelled {
                if case .staleRevision = error {
                    onStatusChange?(.failed("Stale Revision - Pull to refresh"))
                    // Don't retry stale revisions — they'll never succeed
                    removeEntry(gameId: gameId, entryId: entryId)
                } else {
                    onStatusChange?(.failed(apiClient.userFacingErrorMessage(for: error)))
                    markEntryFailed(gameId: gameId, entryId: entryId)
                }
            }
        } catch {
            if !Task.isCancelled {
                onStatusChange?(.failed(apiClient.userFacingErrorMessage(for: error)))
                markEntryFailed(gameId: gameId, entryId: entryId)
            }
        }

        isSyncing = false
    }

    /// Remove a persisted entry after successful sync.
    private func removeEntry(gameId: String, entryId: String?) {
        let context = ModelContext(modelContainer)
        let descriptor: FetchDescriptor<PersistedSyncEntry>
        if let id = entryId {
            descriptor = FetchDescriptor<PersistedSyncEntry>(
                predicate: #Predicate { $0.id == id }
            )
        } else {
            descriptor = FetchDescriptor<PersistedSyncEntry>(
                predicate: #Predicate { $0.gameId == gameId }
            )
        }
        if let entries = try? context.fetch(descriptor) {
            for entry in entries {
                context.delete(entry)
            }
            try? context.save()
        }
    }

    /// Increment retry count and mark as failed.
    private func markEntryFailed(gameId: String, entryId: String?) {
        let context = ModelContext(modelContainer)
        let descriptor: FetchDescriptor<PersistedSyncEntry>
        if let id = entryId {
            descriptor = FetchDescriptor<PersistedSyncEntry>(
                predicate: #Predicate { $0.id == id }
            )
        } else {
            descriptor = FetchDescriptor<PersistedSyncEntry>(
                predicate: #Predicate { $0.gameId == gameId }
            )
        }
        if let entries = try? context.fetch(descriptor) {
            for entry in entries {
                entry.retryCount += 1
                entry.status = "failed"
            }
            try? context.save()
        }
    }
}
