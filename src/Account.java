/**
 * Represents one saved login for a website.
 * The password is stored only in encrypted form (never plain text).
 */
public class Account {

    /** Website or service name (e.g. "Gmail"). */
    private String site;

    /** User's login name for that site. */
    private String username;

    /** Password after XOR encryption — not human-readable until decrypted. */
    private String encryptedPassword;

    /**
     * Creates a new account record.
     *
     * @param site the site name
     * @param username          the username
     * @param encryptedPassword the already-encrypted password
     */
    public Account(String site, String username, String encryptedPassword) {
        this.site = site;
        this.username = username;
        this.encryptedPassword = encryptedPassword;
    }

    public String getSite() {
        return site;
    }

    public String getUsername() {
        return username;
    }

    public String getEncryptedPassword() {
        return encryptedPassword;
    }

    public void setEncryptedPassword(String encryptedPassword) {
        this.encryptedPassword = encryptedPassword;
    }
}
