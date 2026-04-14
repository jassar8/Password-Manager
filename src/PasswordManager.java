import java.util.ArrayList;
import java.util.Random;

/**
 * Core logic for the password manager: validation, encryption, storage, and login checks.
 */
public class PasswordManager {

    /** Fixed XOR key required by the assignment (same for encrypt and decrypt). */
    public static final char ENCRYPTION_KEY = 'K';

    /** All saved accounts (passwords inside each Account are encrypted). */
    private ArrayList<Account> accounts;

    public PasswordManager() {
        accounts = new ArrayList<Account>();
    }

    /**
     * @return the internal list (same object the manager uses)
     */
    public ArrayList<Account> getAccounts() {
        return accounts;
    }

    /**
     * Strong password rules: length exactly 8, and at least one uppercase, lowercase, digit, and symbol.
     *
     * @param password the password to check
     * @return true if all rules pass
     */
    public static boolean isStrongPassword(String password) {
        if (password == null || password.length() != 8) {
            return false;
        }

        boolean hasUpper = false;
        boolean hasLower = false;
        boolean hasDigit = false;
        boolean hasSymbol = false;

        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (Character.isUpperCase(c)) {
                hasUpper = true;
            } else if (Character.isLowerCase(c)) {
                hasLower = true;
            } else if (Character.isDigit(c)) {
                hasDigit = true;
            } else if (!Character.isLetterOrDigit(c)) {
                // Anything that is not a letter or number counts as a symbol (e.g. ! @ #).
                hasSymbol = true;
            }
        }

        return hasUpper && hasLower && hasDigit && hasSymbol;
    }

    /**
     * Builds a random password that always satisfies {@link #isStrongPassword(String)}.
     * Length is always exactly 8.
     *
     * @return a new strong password
     */
    public static String generateStrongPassword() {
        String upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String lowerCase = "abcdefghijklmnopqrstuvwxyz";
        String digits = "0123456789";
        String symbols = "!@#$%&*";

        Random random = new Random();
        char[] chars = new char[8];

        // Guarantee one character from each required group first.
        chars[0] = upperCase.charAt(random.nextInt(upperCase.length()));
        chars[1] = lowerCase.charAt(random.nextInt(lowerCase.length()));
        chars[2] = digits.charAt(random.nextInt(digits.length()));
        chars[3] = symbols.charAt(random.nextInt(symbols.length()));

        // Fill the remaining positions with random choices from all allowed types.
        String allAllowed = upperCase + lowerCase + digits + symbols;
        for (int i = 4; i < 8; i++) {
            chars[i] = allAllowed.charAt(random.nextInt(allAllowed.length()));
        }

        // Shuffle so the required characters are not always in the same positions.
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char temp = chars[i];
            chars[i] = chars[j];
            chars[j] = temp;
        }

        return new String(chars);
    }

    /**
     * XOR each character with the key. Encrypt and decrypt use the same operation.
     *
     * @param password plain text to protect
     * @param key      XOR key (assignment uses a fixed key)
     * @return encrypted string (may contain non-printable characters; stored as-is)
     */
    public static String encrypt(String password, char key) {
        if (password == null) {
            return null;
        }
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < password.length(); i++) {
            result.append((char) (password.charAt(i) ^ key));
        }
        return result.toString();
    }

    /**
     * Reverses {@link #encrypt(String, char)} using the same key (XOR is symmetric).
     *
     * @param encrypted ciphertext from encrypt()
     * @param key       same key used for encryption
     * @return original plain text password
     */
    public static String decrypt(String encrypted, char key) {
        if (encrypted == null) {
            return null;
        }
        // XOR again with the same key gives back the original text.
        return encrypt(encrypted, key);
    }

    /**
     * Adds an account only if the password is strong. Password is encrypted before saving.
     *
     * @param site     site name
     * @param username username
     * @param password plain-text password (will be validated, then encrypted)
     * @return true if added, false if validation failed
     */
    public boolean addAccount(String site, String username, String password) {
        if (!isStrongPassword(password)) {
            return false;
        }
        String encrypted = encrypt(password, ENCRYPTION_KEY);
        accounts.add(new Account(site, username, encrypted));
        return true;
    }

    /**
     * Prints every account with site, username, and decrypted password for display in the console.
     */
    public void showAllAccounts() {
        if (accounts.isEmpty()) {
            System.out.println("(No accounts saved yet.)");
            return;
        }
        System.out.println("--- All accounts ---");
        for (int i = 0; i < accounts.size(); i++) {
            Account a = accounts.get(i);
            String plain = decrypt(a.getEncryptedPassword(), ENCRYPTION_KEY);
            System.out.println("Site: " + a.getSite());
            System.out.println("  Username: " + a.getUsername());
            System.out.println("  Password (decrypted): " + plain);
            System.out.println();
        }
    }

    /**
     * Pretends to sign in: finds matching site + username and compares the password.
     *
     * @param site     site to look up
     * @param username username to look up
     * @param password plain-text password to try
     */
    public void simulateLogin(String site, String username, String password) {
        for (int i = 0; i < accounts.size(); i++) {
            Account a = accounts.get(i);
            if (a.getSite().equalsIgnoreCase(site) && a.getUsername().equals(username)) {
                String storedPlain = decrypt(a.getEncryptedPassword(), ENCRYPTION_KEY);
                if (storedPlain.equals(password)) {
                    System.out.println("Signed in");
                    return;
                }
                System.out.println("Error! Wrong username or password!");
                return;
            }
        }
        System.out.println("Error! Wrong username or password!");
    }

    /**
     * Loads 10 sample accounts so the program has data on first run (assignment requirement).
     * Each demo password is strong, then stored encrypted.
     */
    public void addDemoAccounts() {
        // Plain passwords are strong (length 8, upper, lower, digit, symbol); stored encrypted only.
        String[][] demo = {
            { "Gmail", "user01", "Ab1!xyZa" },
            { "GitHub", "dev_student", "Bc2@mnOp" },
            { "Canvas", "stu123", "Cd3#pqRs" },
            { "Library", "borrower1", "De4$rsTu" },
            { "BankApp", "client_a", "Ef5%uvWx" },
            { "ShopSite", "buyer99", "Fg6&yzAb" },
            { "Forum", "poster_x", "Gh7*bcDe" },
            { "Cloud", "sync_user", "Hi8!fgHi" },
            { "News", "reader01", "Ij9@ijKl" },
            { "Games", "player42", "Jk0#mnop" }
        };

        for (int i = 0; i < demo.length; i++) {
            String site = demo[i][0];
            String user = demo[i][1];
            String plain = demo[i][2];
            String encrypted = encrypt(plain, ENCRYPTION_KEY);
            accounts.add(new Account(site, user, encrypted));
        }
    }
}
