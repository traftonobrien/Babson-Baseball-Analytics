import SwiftUI
import SwiftData

/// Main tab container shown after authentication.
struct MainTabView: View {
    @Environment(APIClient.self) private var apiClient
    @Environment(\.modelContext) private var modelContext

    @State private var gameStore: GameStore?

    var body: some View {
        Group {
            if let store = gameStore {
                TabView {
                    GamesListView(gameStore: store)
                        .tabItem {
                            Label("Games", systemImage: "list.bullet.clipboard")
                        }
                    SettingsView(gameStore: store)
                        .tabItem {
                            Label("Settings", systemImage: "gear")
                        }
                }
            } else {
                ProgressView("Loading…")
            }
        }
        .onAppear {
            if gameStore == nil {
                gameStore = GameStore(modelContext: modelContext, apiClient: apiClient)
            }
        }
    }
}

/// Settings tab — server config, logout, diagnostics.
struct SettingsView: View {
    let gameStore: GameStore
    @Environment(APIClient.self) private var apiClient

    @State private var serverURL = ""
    @State private var showConfirmLogout = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    HStack {
                        Text("URL")
                        Spacer()
                        TextField("https://...", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 300)
                            .onSubmit {
                                apiClient.baseURL = serverURL
                            }
                    }
                }

                Section("Data") {
                    HStack {
                        Text("Cached Games")
                        Spacer()
                        Text("\(gameStore.games.count)")
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Cached Pitchers")
                        Spacer()
                        Text("\(gameStore.pitchers.count)")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        showConfirmLogout = true
                    }
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                serverURL = apiClient.baseURL
            }
            .alert("Sign Out?", isPresented: $showConfirmLogout) {
                Button("Sign Out", role: .destructive) {
                    apiClient.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to enter the charting password again to sign back in.")
            }
        }
    }
}
