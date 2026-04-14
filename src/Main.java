import java.util.Scanner;

/**
 * Entry point: master login, then a console menu for the password manager.
 */
public class Main {

    /** Master credentials — user must enter these before using the app. */
    private static final String MASTER_USERNAME = "admin";
    /** Exactly 8 characters; strong password for consistency. */
    private static final String MASTER_PASSWORD = "Adm1!nXy";

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("========== Password Manager ==========");
        System.out.println("Please log in with your master account.\n");

        // Master login gate: repeat until correct or user gives up (we loop until success).
        boolean loggedIn = false;
        while (!loggedIn) {
            System.out.print("Master username: ");
            String u = scanner.nextLine();
            System.out.print("Master password: ");
            String p = scanner.nextLine();

            if (MASTER_USERNAME.equals(u) && MASTER_PASSWORD.equals(p)) {
                loggedIn = true;
                System.out.println("\nWelcome! You are now inside the password manager.\n");
            } else {
                System.out.println("Invalid master username or password. Try again.\n");
            }
        }

        PasswordManager manager = new PasswordManager();
        // Assignment: at least 10 demo accounts when the program starts.
        manager.addDemoAccounts();

        boolean running = true;
        while (running) {
            printMenu();
            System.out.print("Enter choice: ");
            String choice = scanner.nextLine().trim();

            if (choice.equals("1")) {
                // Requirement: add account — validate strength; offer generator.
                System.out.print("Site name: ");
                String site = scanner.nextLine();
                System.out.print("Username: ");
                String username = scanner.nextLine();

                System.out.print("Generate a strong password for this account? (y/n): ");
                String gen = scanner.nextLine().trim().toLowerCase();

                String password;
                if (gen.equals("y") || gen.equals("yes")) {
                    password = PasswordManager.generateStrongPassword();
                    System.out.println("Generated password: " + password);
                } else {
                    System.out.print("Password (must be exactly 8 chars, strong): ");
                    password = scanner.nextLine();
                }

                if (manager.addAccount(site, username, password)) {
                    System.out.println("Account saved (password stored encrypted).\n");
                } else {
                    System.out.println("Could not save: password does not meet strength rules.\n");
                }

            } else if (choice.equals("2")) {
                // Show all: site, username, decrypted password.
                manager.showAllAccounts();

            } else if (choice.equals("3")) {
                // Stand-alone password generator.
                String generated = PasswordManager.generateStrongPassword();
                System.out.println("New strong password: " + generated + "\n");

            } else if (choice.equals("4")) {
                System.out.print("Site: ");
                String site = scanner.nextLine();
                System.out.print("Username: ");
                String username = scanner.nextLine();
                System.out.print("Password to try: ");
                String password = scanner.nextLine();
                manager.simulateLogin(site, username, password);
                System.out.println();

            } else if (choice.equals("5")) {
                System.out.println("Goodbye!");
                running = false;

            } else {
                System.out.println("Invalid option. Please choose 1–5.\n");
            }
        }

        scanner.close();
    }

    /**
     * Menu options (maps to assignment items: add, show all, generate, simulate login, exit).
     */
    private static void printMenu() {
        System.out.println("-------- Menu --------");
        System.out.println("1. Add new account");
        System.out.println("2. Show all accounts");
        System.out.println("3. Generate password");
        System.out.println("4. Simulate login");
        System.out.println("5. Exit");
        System.out.println("----------------------");
    }
}
