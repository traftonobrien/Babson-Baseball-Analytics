import SwiftUI
import SwiftData

/// Root view — goes directly to the main app (no login required).
struct RootView: View {
    @Environment(APIClient.self) private var apiClient
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        MainTabView()
            .onAppear {
                apiClient.isAuthenticated = true
            }
    }
}
