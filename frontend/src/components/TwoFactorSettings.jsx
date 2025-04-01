import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Divider,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  Security,
  Check,
  Warning,
  LockOpen,
  Lock,
  ContentCopy,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { styled } from '@mui/material/styles';

const QRCodeImage = styled('img')({
  width: '100%',
  maxWidth: '240px',
  height: 'auto',
  margin: '20px auto',
  display: 'block'
});

const BackupCodeItem = styled(ListItem)({
  fontFamily: 'monospace',
  background: '#f5f5f5',
  borderRadius: '4px',
  marginBottom: '8px'
});

const TwoFactorSettings = () => {
  const { user, setup2FA, verify2FA, disable2FA, regenerateBackupCodes } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [setupMode, setSetupMode] = useState(false);
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmDisablePassword, setConfirmDisablePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);

  const resetState = () => {
    setCurrentStep(0);
    setPassword('');
    setVerificationCode('');
    setError('');
    setSuccess('');
    setQrCodeData('');
    setSecret('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError('');
  };

  const handleVerificationCodeChange = (e) => {
    setVerificationCode(e.target.value);
    setError('');
  };

  const handleSetup = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await setup2FA(password);
      setQrCodeData(result.qr_code);
      setSecret(result.secret);
      setCurrentStep(1);
      setSuccess('Scan the QR code with your authenticator app');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await verify2FA(verificationCode);
      setBackupCodes(result.backup_codes);
      setCurrentStep(2);
      setSuccess('Two-factor authentication enabled successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!confirmDisablePassword) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await disable2FA(confirmDisablePassword);
      setShowDisableDialog(false);
      setConfirmDisablePassword('');
      setSuccess('Two-factor authentication disabled successfully');
      resetState();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirmDisablePassword) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await regenerateBackupCodes(confirmDisablePassword);
      setBackupCodes(result.backup_codes);
      setShowRegenerateDialog(false);
      setConfirmDisablePassword('');
      setShowBackupCodesDialog(true);
      setSuccess('Backup codes regenerated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate backup codes. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(''), 2000);
      },
      () => {
        setError('Failed to copy');
      }
    );
  };

  const renderSetupStepper = () => (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Stepper activeStep={currentStep}>
        <Step>
          <StepLabel>Confirm Password</StepLabel>
        </Step>
        <Step>
          <StepLabel>Scan QR Code</StepLabel>
        </Step>
        <Step>
          <StepLabel>Save Backup Codes</StepLabel>
        </Step>
      </Stepper>
    </Box>
  );

  const renderSetupSteps = () => {
    switch (currentStep) {
      case 0:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              To set up two-factor authentication, please enter your password:
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              InputProps={{
                endAdornment: (
                  <Button 
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </Button>
                ),
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleSetup}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Continue'}
            </Button>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              Scan this QR code with your authenticator app (like Google Authenticator, Authy, or Microsoft Authenticator):
            </Typography>
            
            {qrCodeData && (
              <QRCodeImage 
                src={`data:image/png;base64,${qrCodeData}`} 
                alt="QR Code for 2FA"
              />
            )}
            
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                If you can't scan the QR code, enter this code manually in your app:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2" fontFamily="monospace">
                    {secret}
                  </Typography>
                  <Button 
                    startIcon={<ContentCopy />}
                    onClick={() => copyToClipboard(secret)}
                    size="small"
                  >
                    Copy
                  </Button>
                </Box>
              </Paper>
            </Box>
            
            <Typography variant="body1" gutterBottom sx={{ mt: 3 }}>
              Enter the verification code from your app:
            </Typography>
            <TextField
              fullWidth
              margin="normal"
              label="Verification Code"
              value={verificationCode}
              onChange={handleVerificationCodeChange}
              placeholder="Enter 6-digit code"
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerify}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Success</AlertTitle>
              Two-factor authentication has been successfully enabled for your account!
            </Alert>
            
            <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Save Your Backup Codes
            </Typography>
            <Typography variant="body2" gutterBottom color="text.secondary" sx={{ mb: 2 }}>
              Store these backup codes in a safe place. Each backup code can be used once if you lose access to your authenticator app.
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', mb: 3 }}>
              <List dense>
                {backupCodes.map((code, index) => (
                  <BackupCodeItem key={index}>
                    <ListItemText primary={code} />
                  </BackupCodeItem>
                ))}
              </List>
              <Button 
                fullWidth
                variant="outlined" 
                startIcon={<ContentCopy />}
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
              >
                Copy All Codes
              </Button>
            </Paper>
            
            <Alert severity="warning">
              <AlertTitle>Important</AlertTitle>
              These backup codes will not be shown again. Make sure you save them now!
            </Alert>
            
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                resetState();
                setSetupMode(false);
              }}
              sx={{ mt: 3 }}
            >
              Done
            </Button>
          </Box>
        );
      default:
        return null;
    }
  };

  const renderCurrentStatus = () => (
    <Card variant="outlined" sx={{ mb: 4 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            {user?.two_factor_enabled ? (
              <Lock color="primary" fontSize="large" />
            ) : (
              <LockOpen color="action" fontSize="large" />
            )}
          </Grid>
          <Grid item xs>
            <Typography variant="h6">
              Two-Factor Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.two_factor_enabled 
                ? 'Your account is protected with two-factor authentication.' 
                : 'Add an extra layer of security to your account.'}
            </Typography>
          </Grid>
          <Grid item>
            <Switch
              checked={user?.two_factor_enabled || false}
              onChange={() => {
                if (user?.two_factor_enabled) {
                  setShowDisableDialog(true);
                } else {
                  setSetupMode(true);
                }
              }}
              color="primary"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Paper sx={{ p: 4, maxWidth: '800px', margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Security color="primary" sx={{ mr: 2, fontSize: 40 }} />
        <Typography variant="h4">Two-Factor Authentication</Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && !setupMode && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      {!setupMode ? (
        <>
          {renderCurrentStatus()}
          
          {user?.two_factor_enabled && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Account Recovery Options
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setShowRegenerateDialog(true)}
                sx={{ mr: 2 }}
              >
                Generate New Backup Codes
              </Button>
            </Box>
          )}
        </>
      ) : (
        <>
          {renderSetupStepper()}
          {renderSetupSteps()}
        </>
      )}
      
      {/* Disable 2FA Confirmation Dialog */}
      <Dialog open={showDisableDialog} onClose={() => setShowDisableDialog(false)}>
        <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will remove the extra layer of security from your account. Are you sure you want to continue?
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={confirmDisablePassword}
            onChange={(e) => setConfirmDisablePassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <Button 
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </Button>
              ),
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowDisableDialog(false);
            setConfirmDisablePassword('');
            setError('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleDisable} 
            color="error" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={showRegenerateDialog} onClose={() => setShowRegenerateDialog(false)}>
        <DialogTitle>Generate New Backup Codes</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will invalidate your previous backup codes. Please confirm your password to continue.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={confirmDisablePassword}
            onChange={(e) => setConfirmDisablePassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <Button 
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </Button>
              ),
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowRegenerateDialog(false);
            setConfirmDisablePassword('');
            setError('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleRegenerateBackupCodes} 
            color="primary" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* View Backup Codes Dialog */}
      <Dialog 
        open={showBackupCodesDialog} 
        onClose={() => setShowBackupCodesDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Your New Backup Codes</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Store these backup codes in a safe place. Each code can be used once to access your account if you lose your authenticator device.
          </DialogContentText>
          
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', mb: 3 }}>
            <List dense>
              {backupCodes.map((code, index) => (
                <BackupCodeItem key={index}>
                  <ListItemText primary={code} />
                </BackupCodeItem>
              ))}
            </List>
            <Button 
              fullWidth
              variant="outlined" 
              startIcon={<ContentCopy />}
              onClick={() => copyToClipboard(backupCodes.join('\n'))}
            >
              Copy All Codes
            </Button>
          </Paper>
          
          <Alert severity="warning">
            <AlertTitle>Important</AlertTitle>
            These backup codes will not be shown again. Make sure you save them now!
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowBackupCodesDialog(false)} 
            color="primary"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TwoFactorSettings;
