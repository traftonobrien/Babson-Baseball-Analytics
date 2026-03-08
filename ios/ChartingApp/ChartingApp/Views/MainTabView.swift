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
    @State private var isTestingConnection = false
    @State private var isRefreshingBootstrap = false
    @State private var connectionMessage: String?
    @State private var isConnectionError = false

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
                                connectionMessage = nil
                            }
                    }

                    HStack {
                        Button("Save URL") {
                            apiClient.baseURL = serverURL
                            connectionMessage = nil
                        }
                        .buttonStyle(.bordered)

                        Spacer()

                        Button {
                            testConnection()
                        } label: {
                            if isTestingConnection {
                                ProgressView()
                            } else {
                                Label("Test Connection", systemImage: "network")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isTestingConnection)
                    }

                    Text("Use 127.0.0.1 in the simulator. On a physical iPad, use your Mac's LAN address instead.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let connectionMessage {
                        Text(connectionMessage)
                            .font(.caption)
                            .foregroundStyle(isConnectionError ? .orange : .green)
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
                    HStack {
                        Text("Cached Roster Players")
                        Spacer()
                        Text("\(gameStore.rosterPlayers.count)")
                            .foregroundStyle(.secondary)
                    }
                    Button {
                        refreshBootstrap()
                    } label: {
                        if isRefreshingBootstrap {
                            ProgressView()
                        } else {
                            Label("Refresh Roster & Pitchers", systemImage: "arrow.clockwise")
                        }
                    }
                    .disabled(isRefreshingBootstrap)
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

    private func testConnection() {
        isTestingConnection = true
        connectionMessage = nil
        isConnectionError = false

        Task {
            do {
                try await apiClient.ping()
                connectionMessage = "Connected to \(apiClient.baseURL)."
                isConnectionError = false
            } catch {
                connectionMessage = apiClient.userFacingErrorMessage(for: error)
                isConnectionError = true
            }
            isTestingConnection = false
        }
    }

    private func refreshBootstrap() {
        isRefreshingBootstrap = true

        Task {
            await gameStore.fetchBootstrap()
            connectionMessage = gameStore.errorMessage ?? "Roster and pitcher data refreshed."
            isConnectionError = gameStore.errorMessage != nil
            isRefreshingBootstrap = false
        }
    }
}
