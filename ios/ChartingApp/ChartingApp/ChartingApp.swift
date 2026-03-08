import SwiftUI
import SwiftData

@main
struct ChartingApp: App {

    let apiClient = APIClient()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(apiClient)
        }
        .modelContainer(for: [
            PersistedGame.self,
            PersistedSegment.self,
            PersistedPlateAppearance.self,
            PersistedPitch.self,
            PersistedLineupEntry.self,
            PersistedBootstrapPitcher.self,
            PersistedSyncEntry.self,
        ])
    }
}
