/**
 * @file Profile.tsx
 * @description User profile management page.
 *
 * Displays user account information and provides tabbed sections for:
 *  - **Account**  – read-only display of name, email, and account ID.
 *  - **Allergies** – add/remove food allergy tags and save them to the server.
 *  - **Diet Preferences** – select a diet type and save it to the server.
 *
 * On mount the component fetches the full user profile from the API
 * (`GET /api/profile/:id`) and refreshes `localStorage` with the response.
 * Profile changes are persisted via `PATCH /api/profile/:id`.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout";
import { showToast } from "../layout/toastUtils";
import "./Profile.css";
import { API_BASE_URL } from "../../config";

/** The shape of the user profile data returned by the API. */
interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    /** List of food allergies/intolerances (may be absent for new users). */
    allergies?: string[];
    /** ISO 8601 timestamp of when the account was created. */
    registeredAt?: string;
    /** User's dietary lifestyle, e.g. "vegan", "vegetarian", "none". */
    dietPreference?: string;
}
interface ProfileResponse {
    message?: string;
    user?: UserProfile;
}
/** The available tabs on the profile page. */
type ProfileTab = "account" | "allergies" | "diet";

/**
 * Profile page component.
 *
 * Handles data fetching, tab navigation, form state, and API persistence
 * for user account details, allergy list, and diet preference.
 */
function Profile() {
    const navigate = useNavigate();
    const logout = useLogout();

    /** Full user profile fetched from the API. */
    const [user, setUser] = useState<UserProfile | null>(null);

    /** True while the initial profile fetch is in-flight. */
    const [isLoading, setIsLoading] = useState(true);

    /** Currently selected diet preference (controlled radio group). */
    const [dietPreference, setDietPreference] = useState<string>("none");

    /** True while the diet preference PATCH request is in-flight. */
    const [isSaving, setIsSaving] = useState(false);

    /** Inline status message shown after a diet save attempt. */
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    /** Which profile tab is currently displayed. */
    const [activeTab, setActiveTab] = useState<ProfileTab>("account");

    /** The value of the "add allergy" text input. */
    const [newAllergy, setNewAllergy] = useState("");

    /** The working allergy list shown in the UI (may differ from server state until saved). */
    const [displayedAllergies, setDisplayedAllergies] = useState<string[]>([]);

    /** True while the allergy PATCH request is in-flight. */
    const [isSavingAllergies, setIsSavingAllergies] = useState(false);

    /** Inline status message shown after an allergy save attempt. */
    const [allergiesMessage, setAllergiesMessage] = useState<string | null>(null);

    /**
     * On mount: load the stored user from localStorage and fetch the
     * full profile from the API to get the latest server data.
     */
    useEffect(() => {
        const storedUser = localStorage.getItem('user');

        if (!storedUser) {
            // No session → redirect to login
            navigate('/login');
            return;
        }

        const userData = JSON.parse(storedUser);

        // Fetch full profile data from the server
        (async () => {
            try {
                const resp = await fetch(`${API_BASE_URL}/api/profile/${userData.id}`);
                const text = await resp.text();
                let parsed: ProfileResponse = {};
                if (text) {
                    try {
                        parsed = JSON.parse(text) as ProfileResponse;
                    } catch {
                        throw new Error("Invalid JSON from server");
                    }
                }
                if (!resp.ok) {
                    throw new Error(parsed?.message || `HTTP ${resp.status}`);
                }
                const u = parsed.user;
                if (!u) {
                    throw new Error("No user returned");
                }

                setUser(u);
                setDietPreference(u?.dietPreference ?? "none");
                // Keep localStorage in sync with the latest server data
                localStorage.setItem("user", JSON.stringify(u));
                setDisplayedAllergies(Array.isArray(u?.allergies) ? u.allergies : []);
            } catch  {
                // Silently fail – the UI will still show the locally stored data
            } finally {
                setIsLoading(false);
            }
        })();
    }, [navigate]);

    /** Alias for the `logout` callback returned by `useLogout`. */
    const handleLogout = logout;

    /**
     * Adds the current value of `newAllergy` to the displayed allergy list.
     * Ignores empty strings and duplicates.
     */
    const handleAddAllergy = () => {
        const value = newAllergy.trim();
        if (!value || displayedAllergies.includes(value)) return;
        setNewAllergy("");
        setDisplayedAllergies((prev) => [...prev, value]);
    };

    /**
     * Removes an allergy from the displayed list (not yet persisted to the server).
     *
     * @param allergy - The allergy string to remove.
     */
    const handleRemoveAllergy = (allergy: string) => {
        setDisplayedAllergies((prev) => prev.filter((a) => a !== allergy));
    };

    /**
     * Persists the currently selected `dietPreference` to the server via
     * `PATCH /api/profile/:id`.  Updates local state and `localStorage`
     * on success and shows a toast notification either way.
     */
    const handleSaveDiet = async () => {
        if (!user) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            const resp = await fetch(`${API_BASE_URL}/api/profile/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dietPreference })
            });

            const text = await resp.text();
            let parsed: ProfileResponse = {};
            if (text) {
                try { parsed = JSON.parse(text); } catch { throw new Error('Server returned invalid JSON'); }
            }

            if (!resp.ok) {
                throw new Error(parsed?.message || `HTTP ${resp.status}`);
            }

            const u = parsed.user;
            if (!u) throw new Error('No user returned');
            setUser(u);
            setDietPreference(u?.dietPreference ?? "none");
            localStorage.setItem("user", JSON.stringify(u));
            setSaveMessage("Saved");
            showToast("Diet preference saved!", "success");
        } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Save failed";
        setSaveMessage(message);
        showToast(message, "error");
    }finally {
            setIsSaving(false);
            // Clear the inline status message after a short delay
            setTimeout(() => setSaveMessage(null), 2500);
        }
    };

    /**
     * Persists the current `displayedAllergies` list to the server via
     * `PATCH /api/profile/:id`.  Updates local state and `localStorage`
     * on success.
     */
    const handleSaveAllergies = async () => {
        if (!user) return;
        setIsSavingAllergies(true);
        setAllergiesMessage(null);

        try {
            const resp = await fetch(`${API_BASE_URL}/api/profile/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ allergies: displayedAllergies }),
            });

            const text = await resp.text();
            let parsed: ProfileResponse = {};
            if (text) {
            try { parsed = JSON.parse(text); } catch { throw new Error("Server returned invalid JSON"); }
            }

            if (!resp.ok) {
            throw new Error(parsed?.message || `HTTP ${resp.status}`);
            }

            const u = parsed.user;
            if (!u) {
                throw new Error("No user returned");
            }

            setUser(u);
            setDisplayedAllergies(Array.isArray(u?.allergies) ? u.allergies : []);
            localStorage.setItem("user", JSON.stringify(u));
            setAllergiesMessage("Saved");
            showToast("Allergies updated!", "success");
        }  catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Save failed";
        setAllergiesMessage(message);
        showToast(message, "error");
    } finally {
            setIsSavingAllergies(false);
            setTimeout(() => setAllergiesMessage(null), 2500);
        }
        };

    /**
     * Formats an ISO 8601 date string into a human-readable date.
     *
     * @param dateString - ISO date string (e.g. `"2025-01-15T10:30:00.000Z"`).
     * @returns A localised date string (e.g. `"January 15, 2025"`), or `"N/A"`.
     */
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Show a loading spinner while the API call is in-flight
    if (isLoading) {
        return (
            <div className="profile-container">
                <div className="profile-card">
                    <div className="loading-spinner">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            <div className="profile-card">
                {/* ── User avatar and display name ── */}
                <div className="profile-header">
                    <div className="avatar">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                    </div>
                    <h1>{user?.firstName} {user?.lastName}</h1>
                    <p className="member-since">Member since {formatDate(user?.registeredAt)}</p>
                </div>

                {/* ── Tab navigation ── */}
                <div className="profile-tabs">
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === "account" ? "active" : ""}`}
                        onClick={() => setActiveTab("account")}
                    >
                        Account
                    </button>
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === "allergies" ? "active" : ""}`}
                        onClick={() => setActiveTab("allergies")}
                    >
                        Allergies
                    </button>
                    <button
                        type="button"
                        className={`profile-tab ${activeTab === "diet" ? "active" : ""}`}
                        onClick={() => setActiveTab("diet")}
                    >
                        Diet Preferences
                    </button>
                </div>

                {/* ── Tab: Account (read-only) ── */}
                {activeTab === "account" && (
                    <div className="profile-details">
                        <div className="detail-group">
                            <label>First Name</label>
                            <div className="detail-value">{user?.firstName}</div>
                        </div>

                        <div className="detail-group">
                            <label>Last Name</label>
                            <div className="detail-value">{user?.lastName}</div>
                        </div>

                        <div className="detail-group">
                            <label>Email Address</label>
                            <div className="detail-value">{user?.email}</div>
                        </div>

                        <div className="detail-group">
                            <label>Account ID</label>
                            <div className="detail-value detail-id">{user?.id}</div>
                        </div>
                    </div>
                )}

                {/* ── Tab: Allergies ── */}
                {activeTab === "allergies" && (
                    <div className="profile-details allergies-tab">
                        <div className="detail-group">
                            <label>Your allergies</label>
                            <div className="allergies-section">
                                {/* Empty state */}
                                {displayedAllergies.length === 0 ? (
                                    <p className="allergies-empty">No allergies listed. Add any ingredients or foods to avoid.</p>
                                ) : (
                                    /* Allergy tag list */
                                    <ul className="allergies-list">
                                        {displayedAllergies.map((a) => (
                                            <li key={a} className="allergy-tag">
                                                <span>{a}</span>
                                                <button
                                                    type="button"
                                                    className="allergy-remove"
                                                    onClick={() => handleRemoveAllergy(a)}
                                                    aria-label={`Remove ${a}`}
                                                >
                                                    ×
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Add allergy input row */}
                                <div className="allergy-input-row">
                                    <input
                                        type="text"
                                        className="allergy-input"
                                        placeholder="e.g. Peanuts, Dairy"
                                        value={newAllergy}
                                        onChange={(e) => setNewAllergy(e.target.value)}
                                        // Allow pressing Enter to add the allergy
                                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddAllergy())}
                                    />
                                    <button
                                        type="button"
                                        className="allergy-add-btn"
                                        onClick={handleAddAllergy}
                                        disabled={!newAllergy.trim()}
                                    >
                                        Add
                                    </button>
                                </div>

                                {/* Save button + inline status message */}
                                <div className="diet-actions">
                                    <button
                                        type="button"
                                        className="submit-button"
                                        onClick={handleSaveAllergies}
                                        disabled={isSavingAllergies}
                                    >
                                        {isSavingAllergies ? "Saving..." : "Save Allergies"}
                                    </button>

                                    {allergiesMessage && (
                                        <span className={allergiesMessage === "Saved" ? "diet-save-success" : "diet-save-error"}>
                                        {allergiesMessage}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tab: Diet Preferences ── */}
                {activeTab === "diet" && (
                    <div className="profile-details diet-tab" aria-live="polite">
                        <div className="detail-group">
                            <label>Select Your Diet Preference</label>
                            <div className="diet-options-grid">
                                {/* Radio group for diet types */}
                                <label className="diet-option">
                                    <input type="radio" name="diet" value="none" checked={dietPreference === "none"} onChange={() => setDietPreference("none")} />
                                    <span>None</span>
                                </label>
                                <label className="diet-option">
                                    <input type="radio" name="diet" value="vegan" checked={dietPreference === "vegan"} onChange={() => setDietPreference("vegan")} />
                                    <span>Vegan</span>
                                </label>
                                <label className="diet-option">
                                    <input type="radio" name="diet" value="vegetarian" checked={dietPreference === "vegetarian"} onChange={() => setDietPreference("vegetarian")} />
                                    <span>Vegetarian</span>
                                </label>
                                <label className="diet-option">
                                    <input type="radio" name="diet" value="pescatarian" checked={dietPreference === "pescatarian"} onChange={() => setDietPreference("pescatarian")} />
                                    <span>Pescatarian</span>
                                </label>
                                <label className="diet-option">
                                    <input type="radio" name="diet" value="omnivore" checked={dietPreference === "omnivore"} onChange={() => setDietPreference("omnivore")} />
                                    <span>Omnivore</span>
                                </label>
                            </div>
                            {/* Save diet + inline status */}
                            <div className="diet-actions">
                                <button onClick={handleSaveDiet} className="submit-button" disabled={isSaving}>
                                    {isSaving ? "Saving..." : "Save Preference"}
                                </button>
                                {saveMessage && <span className={saveMessage === "Saved" ? "diet-save-success" : "diet-save-error"}>{saveMessage}</span>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Logout button ── */}
                <div className="profile-actions">
                    <button onClick={handleLogout} className="logout-button">
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Profile;
