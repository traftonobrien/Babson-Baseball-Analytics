import SwiftUI
import SwiftData

/// Games tab — lists recent games with pull-to-refresh, "New Game" button.
struct GamesListView: View {
    @Bindable var gameStore: GameStore
    @Environment(APIClient.self) private var apiClient

    @State private var showNewGame = false
    @State private var selectedGameId: String?

    var body: some View {
        NavigationStack {
            Group {
                if gameStore.games.isEmpty && !gameStore.isLoading {
                    ContentUnavailableView {
                        Label("No Games", systemImage: "baseball.diamond.bases")
                    } description: {
                        Text("Create a new game or pull down to refresh from the server.")
                    } actions: {
                        Button("New Game") { showNewGame = true }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    List(gameStore.games, id: \.id) { game in
                        Button {
                            selectedGameId = game.id
                            openGame(id: game.id)
                        } label: {
                            GameRowView(game: game)
                        }
                        .tint(.primary)
                    }
                    .refreshable {
                        await gameStore.fetchBootstrap()
                    }
                }
            }
            .navigationTitle("Games")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showNewGame = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewGame) {
                GameSetupView(gameStore: gameStore)
            }
            .navigationDestination(item: $selectedGameId) { gameId in
                GameDetailView(gameStore: gameStore, gameId: gameId)
            }
            .overlay {
                if gameStore.isLoading {
                    ProgressView()
                }
            }
            .onAppear {
                gameStore.loadLocalGames()
                gameStore.loadLocalPitchers()
                if gameStore.games.isEmpty {
                    Task { await gameStore.fetchBootstrap() }
                }
            }
        }
    }

    private func openGame(id: String) {
        Task {
            try? await gameStore.openGame(id: id)
        }
    }
}

/// Row view for a single game in the list.
struct GameRowView: View {
    let game: PersistedGame

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("vs \(game.opponent)")
                    .font(.headline)

                Text(game.gameDate)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            StatusBadge(status: game.status)
        }
        .padding(.vertical, 4)
    }
}

/// Small colored badge showing game status.
struct StatusBadge: View {
    let status: String

    var body: some View {
        Text(status.capitalized)
            .font(.caption.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundStyle(.white)
            .clipShape(Capsule())
    }

    private var backgroundColor: Color {
        switch status {
        case "active": return .green
        case "final":  return .blue
        default:       return .orange
        }
    }
}
