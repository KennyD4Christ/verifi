import React, { useState, useEffect } from 'react';
import { fetchUserPreferences, updateUserPreferences } from '../services/api';

const UserPreferences = () => {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const userPreferences = await fetchUserPreferences();
        setPreferences(userPreferences);
      } catch (err) {
        setError('Failed to load user preferences. Please try again later.');
        console.error('Error fetching user preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  const handlePreferenceChange = async (key, value) => {
    try {
      const updatedPreferences = { ...preferences, [key]: value };
      await updateUserPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
    } catch (err) {
      setError('Failed to update preferences. Please try again.');
      console.error('Error updating user preferences:', err);
    }
  };

  if (loading) return <div>Loading preferences...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h2>User Preferences</h2>
      <div>
        <label>
          Dark Mode:
          <input
            type="checkbox"
            checked={preferences.darkMode || false}
            onChange={(e) => handlePreferenceChange('darkMode', e.target.checked)}
          />
        </label>
      </div>
      <div>
        <label>
          Notification Frequency:
          <select
            value={preferences.notificationFrequency || 'daily'}
            onChange={(e) => handlePreferenceChange('notificationFrequency', e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      {/* Add more preference options as needed */}
    </div>
  );
};

export default UserPreferences;
