import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Tabs, 
  Tab, 
  Divider, 
  Button, 
  TextField, 
  Avatar, 
  Grid, 
  Alert, 
  Switch, 
  Card, 
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { 
  Security, 
  Person, 
  Email, 
  Notifications, 
  Payment, 
  Visibility, 
  VisibilityOff,
  Lock,
  CreditCard,
  AccountCircle,
  PhoneAndroid,
  DeleteForever,
  Edit,
  PhotoCamera,
  VerifiedUser,
  Language,
  AccessTime,
  DarkMode
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import TwoFactorSettings from '../components/TwoFactorSettings';

// Styled components
const ProfileAvatar = styled(Avatar)(({ theme }) => ({
  width: theme.spacing(12),
  height: theme.spacing(12),
  marginBottom: theme.spacing(2),
  border: `4px solid ${theme.palette.background.paper}`,
  boxShadow: theme.shadows[3]
}));

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`account-tabpanel-${index}`}
      aria-labelledby={`account-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const AccountSettings = () => {
  const { user, updateProfile, updateEmail, updatePassword, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Profile state
  const [profileData, setProfileData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
    jobTitle: user?.job_title || '',
    bio: user?.bio || '',
  });
  
  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Email preferences state
  const [emailPreferences, setEmailPreferences] = useState({
    marketingEmails: user?.preferences?.marketing_emails || false,
    orderNotifications: user?.preferences?.order_notifications || true,
    securityAlerts: user?.preferences?.security_alerts || true,
    newsletterSubscription: user?.preferences?.newsletter || false,
  });
  
  // Account dialogs state
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showAvatarUploadDialog, setShowAvatarUploadDialog] = useState(false);
  
  // Timezone and language preferences
  const [regionPreferences, setRegionPreferences] = useState({
    language: user?.preferences?.language || 'English',
    timezone: user?.preferences?.timezone || 'UTC',
    dateFormat: user?.preferences?.date_format || 'MM/DD/YYYY',
    darkMode: user?.preferences?.dark_mode || false,
  });
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Reset state when changing tabs
    setSuccess('');
    setError('');
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePreferenceChange = (name) => (event) => {
    setEmailPreferences(prev => ({
      ...prev,
      [name]: event.target.checked
    }));
  };

  const handleRegionPrefChange = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setRegionPreferences(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleToggleShowPassword = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await updateProfile({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        phone: profileData.phone,
        company: profileData.company,
        job_title: profileData.jobTitle,
        bio: profileData.bio
      });
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await updateEmail(profileData.email);
      setSuccess('Email update verification sent. Please check your inbox');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await updatePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      setSuccess('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Assume you have an updatePreferences function in useAuth
      await updatePreferences({
        marketing_emails: emailPreferences.marketingEmails,
        order_notifications: emailPreferences.orderNotifications,
        security_alerts: emailPreferences.securityAlerts,
        newsletter: emailPreferences.newsletterSubscription,
        language: regionPreferences.language,
        timezone: regionPreferences.timezone,
        date_format: regionPreferences.dateFormat,
        dark_mode: regionPreferences.darkMode
      });
      setSuccess('Preferences updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    setLoading(true);
    
    try {
      // Assume you have a deleteAccount function in useAuth
      await deleteAccount();
      logout();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
      setLoading(false);
      setShowDeleteAccountDialog(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('avatar', file);
    
    setLoading(true);
    
    try {
      // Assume you have an updateAvatar function in useAuth
      await updateAvatar(formData);
      setSuccess('Profile picture updated');
      setShowAvatarUploadDialog(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ maxWidth: '1200px', margin: '0 auto', mb: 4 }}>
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Account Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your account information, security settings, and preferences
        </Typography>
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
              <ProfileAvatar src={user?.avatar_url} alt={`${user?.first_name} ${user?.last_name}`}>
                {!user?.avatar_url && `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`}
              </ProfileAvatar>
              <Button 
                variant="outlined" 
                startIcon={<PhotoCamera />}
                onClick={() => setShowAvatarUploadDialog(true)}
              >
                Change Photo
              </Button>
            </Box>
            
            <Box sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
              <Tabs
                orientation="vertical"
                variant="scrollable"
                value={activeTab}
                onChange={handleTabChange}
                aria-label="Account settings tabs"
                sx={{ borderRight: 1, borderColor: 'divider' }}
              >
                <Tab icon={<Person sx={{ mr: 1 }} />} label="Profile" />
                <Tab icon={<Lock sx={{ mr: 1 }} />} label="Security" />
                <Tab icon={<Email sx={{ mr: 1 }} />} label="Notifications" />
                <Tab icon={<Payment sx={{ mr: 1 }} />} label="Billing" />
                <Tab icon={<Language sx={{ mr: 1 }} />} label="Preferences" />
              </Tabs>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={9}>
            {/* Profile Tab */}
            <TabPanel value={activeTab} index={0}>
              <Typography variant="h5" gutterBottom>
                Personal Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Update your basic profile information
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleProfileChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleProfileChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    InputProps={{
                      endAdornment: (
                        <Button 
                          onClick={handleEmailUpdate}
                          disabled={loading || profileData.email === user?.email}
                        >
                          Update
                        </Button>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Company"
                    name="company"
                    value={profileData.company}
                    onChange={handleProfileChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    name="jobTitle"
                    value={profileData.jobTitle}
                    onChange={handleProfileChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Bio"
                    name="bio"
                    value={profileData.bio}
                    onChange={handleProfileChange}
                    multiline
                    rows={4}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    onClick={handleProfileUpdate}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Save Changes'}
                  </Button>
                </Grid>
              </Grid>
            </TabPanel>
            
            {/* Security Tab */}
            <TabPanel value={activeTab} index={1}>
              <Typography variant="h5" gutterBottom>
                Security Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manage your password and two-factor authentication
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 5 }}>
                <Typography variant="h6" gutterBottom>
                  Change Password
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Current Password"
                      name="currentPassword"
                      type={showPassword.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => handleToggleShowPassword('current')}
                              edge="end"
                            >
                              {showPassword.current ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="New Password"
                      name="newPassword"
                      type={showPassword.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => handleToggleShowPassword('new')}
                              edge="end"
                            >
                              {showPassword.new ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Confirm New Password"
                      name="confirmPassword"
                      type={showPassword.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => handleToggleShowPassword('confirm')}
                              edge="end"
                            >
                              {showPassword.confirm ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button 
                      variant="contained" 
                      onClick={handlePasswordUpdate}
                      disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Update Password'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Two-Factor Authentication
                </Typography>
                <TwoFactorSettings />
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Login Sessions
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <List disablePadding>
                      <ListItem>
                        <ListItemIcon>
                          <VerifiedUser color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Current Session" 
                          secondary={`${navigator.platform} - ${navigator.userAgent.split(') ')[0].split(' (')[1]}`} 
                        />
                        <ListItemSecondaryAction>
                          <Button color="error" onClick={logout}>
                            Log Out
                          </Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Box>
              
              <Box>
                <Typography variant="h6" gutterBottom>
                  Delete Account
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Permanently delete your account and all associated data. This action cannot be undone.
                </Typography>
                <Button 
                  variant="outlined" 
                  color="error"
                  startIcon={<DeleteForever />}
                  onClick={() => setShowDeleteAccountDialog(true)}
                >
                  Delete Account
                </Button>
              </Box>
            </TabPanel>
            
            {/* Notifications Tab */}
            <TabPanel value={activeTab} index={2}>
              <Typography variant="h5" gutterBottom>
                Notification Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Control what notifications you receive
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Marketing Emails" 
                    secondary="Receive emails about new features, products, and offers" 
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={emailPreferences.marketingEmails}
                      onChange={handlePreferenceChange('marketingEmails')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemIcon>
                    <Notifications />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Order Notifications" 
                    secondary="Receive updates about your orders and their status" 
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={emailPreferences.orderNotifications}
                      onChange={handlePreferenceChange('orderNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Security Alerts" 
                    secondary="Receive notifications about important security events" 
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={emailPreferences.securityAlerts}
                      onChange={handlePreferenceChange('securityAlerts')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider variant="inset" component="li" />
                
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Newsletter" 
                    secondary="Receive our monthly newsletter with industry trends and tips" 
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={emailPreferences.newsletterSubscription}
                      onChange={handlePreferenceChange('newsletterSubscription')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="contained" 
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Save Preferences'}
                </Button>
              </Box>
            </TabPanel>
            
            {/* Billing Tab */}
            <TabPanel value={activeTab} index={3}>
              <Typography variant="h5" gutterBottom>
                Billing Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manage your billing information and payment methods
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Subscription Plan
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {user?.subscription?.plan || 'Free Plan'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user?.subscription?.description || 'Basic account with limited features'}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Button variant="outlined" color="primary">
                        Upgrade Plan
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Payment Methods
                </Typography>
                
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CreditCard sx={{ mr: 2 }} />
                      <Box>
                        <Typography variant="subtitle1">
                          Visa ending in •••• 4242
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Expires 12/2025
                        </Typography>
                      </Box>
                      <Box sx={{ ml: 'auto' }}>
                        <Button startIcon={<Edit />} sx={{ mr: 1 }}>
                          Edit
                        </Button>
                        <Button color="error">
                          Remove
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
                
                <Button variant="outlined" startIcon={<CreditCard />}>
                  Add Payment Method
                </Button>
              </Box>
              
              <Box>
                <Typography variant="h6" gutterBottom>
                  Billing Address
                </Typography>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="body1">
                      {user?.billing_address?.name || 'John Doe'}
                    </Typography>
                    <Typography variant="body2">
                      {user?.billing_address?.street || '123 Main St'}
                    </Typography>
                    <Typography variant="body2">
                      {user?.billing_address?.city || 'New York'}, {user?.billing_address?.state || 'NY'} {user?.billing_address?.zip || '10001'}
                    </Typography>
                    <Typography variant="body2">
                      {user?.billing_address?.country || 'United States'}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Button startIcon={<Edit />}>
                        Edit Address
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </TabPanel>
            
            {/* Preferences Tab */}
            <TabPanel value={activeTab} index={4}>
              <Typography variant="h5" gutterBottom>
                Regional Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure your language, time zone, and other preferences
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Language"
                    value={regionPreferences.language}
                    onChange={handleRegionPrefChange('language')}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Japanese">Japanese</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Time Zone"
                    value={regionPreferences.timezone}
                    onChange={handleRegionPrefChange('timezone')}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Date Format"
                    value={regionPreferences.dateFormat}
                    onChange={handleRegionPrefChange('dateFormat')}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <ListItem disablePadding>
                      <ListItemIcon>
                        <DarkMode />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Dark Mode" 
                        secondary="Use dark theme throughout the application" 
                      />
                      <Switch
                        edge="end"
                        checked={regionPreferences.darkMode}
                        onChange={handleRegionPrefChange('darkMode')}
                      />
                    </ListItem>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    onClick={handlePreferencesUpdate}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Save Preferences'}
                  </Button>
                </Grid>
              </Grid>
            </TabPanel>
          </Grid>
        </Grid>
      </Box>
      
      {/* Delete Account Dialog */}
      <Dialog
        open={showDeleteAccountDialog}
        onClose={() => setShowDeleteAccountDialog(false)}
      >
        <DialogTitle>Delete Your Account?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This action cannot be undone. All your data, including profile information, orders, and settings will be permanently deleted.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }} color="error">
            To confirm, please type DELETE in the field below:
          </DialogContentText>
          <TextField
            fullWidth
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            variant="outlined"
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteAccountDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="error"
            disabled={loading || deleteConfirmText !== 'DELETE'}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete Forever'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Avatar Upload Dialog */}
      <Dialog
        open={showAvatarUploadDialog}
        onClose={() => setShowAvatarUploadDialog(false)}
      >
        <DialogTitle>Upload Profile Picture</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select an image file to use as your profile picture. We recommend a square image of at least 200x200 pixels.
          </DialogContentText>
          <Button
            variant="contained"
            component="label"
            startIcon={<PhotoCamera />}
          >
            Select Image
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAvatarUploadDialog(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      </Paper>
    );
  };

export default AccountSettings;
