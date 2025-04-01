import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  TextField, Button, Typography, Box, Container, Alert, 
  CircularProgress, Checkbox, FormControlLabel, InputAdornment, 
  IconButton, Paper, Divider
} from '@mui/material';
import { styled } from '@mui/system';
import { Visibility, VisibilityOff, Google, Facebook, KeyOutlined } from '@mui/icons-material';
import { motion } from 'framer-motion';

const StyledForm = styled('form')(({ theme }) => ({
  width: '100%',
  marginTop: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(8),
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

const SocialButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  '&.MuiButton-containedGoogle': {
    backgroundColor: '#DB4437',
    color: theme.palette.common?.white || '#ffffff',
    '&:hover': {
      backgroundColor: '#C23321',
    },
  },
  '&.MuiButton-containedFacebook': {
    backgroundColor: '#4267B2',
    color: theme.palette.common?.white || '#ffffff',
    '&:hover': {
      backgroundColor: '#365899',
    },
  },
}));

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const { login, requires2FA, complete2FALogin } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate2FAForm = () => {
    const newErrors = {};
    if (!twoFactorCode) newErrors.twoFactorCode = "Verification code is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await login(formData.username, formData.password, rememberMe);

      // If 2FA is not required, redirect to dashboard
      if (!result?.requires2FA) {
        navigate('/dashboard');
      }
      // If 2FA is required, the UI will update based on requires2FA state
    } catch (error) {
      setErrors({ general: 'Failed to log in. Please check your credentials.' });
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!validate2FAForm()) return;

    setLoading(true);
    try {
      await complete2FALogin(twoFactorCode, useBackupCode);
      navigate('/dashboard');
    } catch (error) {
      setErrors({
        general: useBackupCode
          ? 'Invalid backup code. Please try again.'
          : 'Invalid verification code. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUseBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setTwoFactorCode('');
    setErrors({});
  };

  const handleSocialLogin = (provider) => {
    // Implement social login logic here
    console.log(`Login with ${provider}`);
  };

  return (
    <Container component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} maxWidth="sm">
      <StyledPaper elevation={3}>
        <Typography component="h1" variant="h4" gutterBottom>
          {requires2FA ? 'Two-Factor Authentication' : 'Sign in'}
        </Typography>

        {requires2FA ? (
          // 2FA Verification Form
          <StyledForm onSubmit={handle2FASubmit}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Tabs value={useBackupCode ? 1 : 0} onChange={() => toggleUseBackupCode()}>
                <Tab label="Verification Code" />
                <Tab label="Backup Code" />
              </Tabs>
            </Box>

            <TextField
              name="twoFactorCode"
              label={useBackupCode ? "Backup Code" : "Verification Code"}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              error={!!errors.twoFactorCode}
              helperText={errors.twoFactorCode}
              fullWidth
              required
              autoFocus
              placeholder={useBackupCode ? "Enter your backup code" : "Enter the 6-digit code"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyOutlined />
                  </InputAdornment>
                ),
              }}
            />

            {errors.general && <Alert severity="error">{errors.general}</Alert>}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={loading}
              sx={{ mt: 2, mb: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify'}
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', mb: 2 }}>
              <Button
                variant="text"
                onClick={toggleUseBackupCode}
                size="small"
              >
                {useBackupCode
                  ? "Use verification code instead"
                  : "Use backup code instead"}
              </Button>
            </Box>
          </StyledForm>
        ) : (
          // Regular Login Form
          <>
            <StyledForm onSubmit={handleSubmit}>
              <TextField
                name="username"
                label="Username"
                value={formData.username}
                onChange={handleChange}
                error={!!errors.username}
                helperText={errors.username}
                fullWidth
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">@</InputAdornment>,
                }}
              />
              <TextField
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                fullWidth
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
                label="Remember me"
              />
              {errors.general && <Alert severity="error">{errors.general}</Alert>}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{ mt: 2, mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 2 }}>
                <Link to="/forgot-password">Forgot password?</Link>
                <Link to="/register">Don't have an account? Sign Up</Link>
              </Box>
            </StyledForm>
            <Divider sx={{ my: 2, width: '100%' }}>OR</Divider>
            <Box sx={{ width: '100%' }}>
              <SocialButton
                fullWidth
                variant="contained"
                startIcon={<Google />}
                onClick={() => handleSocialLogin('Google')}
                className="MuiButton-containedGoogle"
              >
                Sign in with Google
              </SocialButton>
              <SocialButton
                fullWidth
                variant="contained"
                startIcon={<Facebook />}
                onClick={() => handleSocialLogin('Facebook')}
                className="MuiButton-containedFacebook"
              >
                Sign in with Facebook
              </SocialButton>
            </Box>
          </>
        )}
      </StyledPaper>
    </Container>
  );
};

export default Login;
