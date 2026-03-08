import SwiftUI

/// Login screen — simple password entry that calls the charting-login API.
struct LoginView: View {
    @Environment(APIClient.self) private var apiClient

    @State private var password = ""
    @State private var serverURL = ""
    @State private var isLoggingIn = false
    @State private var isTestingConnection = false
    @State private var errorMessage: String?
    @State private var connectionMessage: String?
    @State private var isConnectionError = false
    @State private var showServerConfig = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Spacer()

                // Logo area
                VStack(spacing: 16) {
                    Image(systemName: "baseball.diamond.bases")
                        .font(.system(size: 64))
                        .foregroundStyle(.blue)

                    Text("Pitch Tracker")
                        .font(.largeTitle.bold())

                    Text("Babson Baseball Charting")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 48)

                // Login form
                VStack(spacing: 16) {
                    SecureField("Charting Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                        .submitLabel(.go)
                        .onSubmit { login() }
                        .frame(maxWidth: 360)

                    Button {
                        login()
                    } label: {
                        if isLoggingIn {
                            ProgressView()
                                .frame(maxWidth: 360)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: 360)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(password.isEmpty || isLoggingIn)

                    Button {
                        testConnection()
                    } label: {
                        if isTestingConnection {
                            ProgressView()
                                .frame(maxWidth: 360)
                        } else {
                            Label("Test Connection", systemImage: "network")
                                .frame(maxWidth: 360)
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(isTestingConnection || isLoggingIn)

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }

                    if let connectionMessage {
                        Text(connectionMessage)
                            .font(.caption)
                            .foregroundStyle(isConnectionError ? .orange : .green)
                            .multilineTextAlignment(.center)
                    }
                }

                Spacer()

                // Server URL config
                Button {
                    serverURL = apiClient.baseURL
                    showServerConfig = true
                } label: {
                    Label("Server: \(apiClient.baseURL)", systemImage: "server.rack")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 20)
            }
            .padding()
            .navigationBarTitleDisplayMode(.inline)
            .alert("Server URL", isPresented: $showServerConfig) {
                TextField("https://example.com", text: $serverURL)
                Button("Save") {
                    apiClient.baseURL = serverURL
                    errorMessage = nil
                    connectionMessage = nil
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enter the base URL of the Pitch Tracker server")
            }
        }
    }

    private func login() {
        guard !password.isEmpty else { return }
        isLoggingIn = true
        errorMessage = nil

        Task {
            do {
                try await apiClient.login(password: password)
            } catch {
                errorMessage = apiClient.userFacingErrorMessage(for: error)
            }
            isLoggingIn = false
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
}
