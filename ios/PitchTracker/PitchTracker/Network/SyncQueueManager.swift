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
actor SyncQueueManager {
    
    private let apiClient: APIClient
    private var syncTask: Task<Void, Never>?
    private var isSyncing = false
    
    /// Called when status changes, allowing the UI to react via MainActor.
    private var onStatusChange: (@Sendable (SyncStatus) -> Void)?
    
    func setOnStatusChange(_ handler: @Sendable @escaping (SyncStatus) -> Void) {
        self.onStatusChange = handler
    }
    
    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }
    
    /// Debounces requests and enqueues a sync operation for the given game snapshot payload.
    /// We pass the raw values instead of SwiftData models because models are not sendable across boundaries safely without their context.
    func enqueueSync(
        gameId: String,
        revision: Int,
        payload: ChartingGameSnapshot,
        delaySeconds: Double = 2.0
    ) {
        // Cancel any pending sync that hasn't started yet
        syncTask?.cancel()
        
        onStatusChange?(.pending)
        
        // Start a new debounced task
        syncTask = Task {
            do {
                try await Task.sleep(for: .seconds(delaySeconds))
                if Task.isCancelled { return }
                
                await performSync(gameId: gameId, revision: revision, payload: payload)
            } catch {
                // Sleep cancellation throws CancellationError
            }
        }
    }
    
    /// Perform the actual network request.
    private func performSync(gameId: String, revision: Int, payload: ChartingGameSnapshot) async {
        guard !isSyncing else { return } // Prevent parallel syncs
        isSyncing = true
        onStatusChange?(.syncing)
        
        do {
            // Re-encode the game snapshot into the generic fields dictionary expected by the PATCH route
            let encoder = JSONEncoder()
            let data = try encoder.encode(payload)
            guard let fields = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                throw URLError(.badServerResponse)
            }
            
            // PATCH to /api/charting/games/[id]
            let _ = try await apiClient.updateGame(id: gameId, revision: revision, fields: fields)
            
            if !Task.isCancelled {
                onStatusChange?(.synced)
            }
        } catch let error as APIError {
            if !Task.isCancelled {
                if case .staleRevision = error {
                    onStatusChange?(.failed("Stale Revision - Pull to refresh"))
                } else {
                    onStatusChange?(.failed(apiClient.userFacingErrorMessage(for: error)))
                }
            }
        } catch {
            if !Task.isCancelled {
                onStatusChange?(.failed(apiClient.userFacingErrorMessage(for: error)))
            }
        }
        
        isSyncing = false
    }
}
