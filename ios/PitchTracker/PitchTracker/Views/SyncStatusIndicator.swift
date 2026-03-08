import SwiftUI

/// A small view that displays the current background sync status.
struct SyncStatusIndicator: View {
    let status: SyncStatus
    
    var body: some View {
        HStack(spacing: 4) {
            switch status {
            case .synced:
                Image(systemName: "checkmark.icloud.fill")
                    .foregroundStyle(.green)
                Text("Synced")
            case .syncing:
                ProgressView()
                    .controlSize(.mini)
                Text("Syncing")
            case .pending:
                Image(systemName: "arrow.triangle.2.circlepath.icloud.fill")
                    .foregroundStyle(.orange)
                Text("Pending")
            case .failed(_):
                Image(systemName: "exclamationmark.icloud.fill")
                    .foregroundStyle(.red)
                Text("Error")
            }
        }
        .font(.caption.bold())
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.88))
        .clipShape(Capsule())
    }
}
