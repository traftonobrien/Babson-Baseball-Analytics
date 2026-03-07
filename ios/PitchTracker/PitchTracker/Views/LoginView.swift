import SwiftUI

/// Login screen — simple password entry that calls the charting-login API.
struct LoginView: View {
    @Environment(APIClient.self) private var apiClient

    @State private var password = ""
    @State private var serverURL = ""
    @State private var isLoggingIn = false
    @State private var errorMessage: String?
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

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
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
                errorMessage = error.localizedDescription
            }
            isLoggingIn = false
        }
    }
}
