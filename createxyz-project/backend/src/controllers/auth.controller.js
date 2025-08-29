import { promisify } from 'util';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/error.js';
import { sendEmail } from '../utils/email.js';
import { signToken, createSendToken } from '../utils/jwt.js';

// Generate JWT token
const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER || 'secure-chat-api'
    }
  );
};

// Signup a new user
export const signup = async (req, res, next) => {
  try {
    // 1) Check if user already exists
    const existingUser = await User.findOne({
      where: { email: req.body.email }
    });

    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    // 2) Create new user
    const newUser = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      publicKey: req.body.publicKey
    });

    // 3) Generate email verification token
    const verificationToken = newUser.createEmailVerificationToken();
    await newUser.save({ validateBeforeSave: false });

    // 4) Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;
    
    try {
      await sendEmail({
        email: newUser.email,
        subject: 'Verify your email',
        template: 'email-verification',
        context: {
          name: newUser.username,
          verificationUrl
        }
      });

      // 5) Generate JWT token
      createSendToken(newUser, 201, res);
    } catch (err) {
      // If email sending fails, delete the user
      await newUser.destroy({ force: true });
      return next(
        new AppError('There was an error sending the verification email. Please try again later!', 500)
      );
    }
  } catch (error) {
    next(error);
  }
};

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if user exists && password is correct
    const user = await User.scope('withPassword').findOne({
      where: { email }
    });

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Check if user is active
    if (!user.active) {
      return next(
        new AppError('Your account has been deactivated. Please contact support.', 401)
      );
    }

    // 4) Check if email is verified
    if (!user.emailVerified) {
      return next(
        new AppError('Please verify your email before logging in.', 401)
      );
    }

    // 5) If everything ok, send token to client
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// Logout user
export const logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

// Protect routes - check if user is authenticated
export const protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      return next(
        new AppError('The user belonging to this token no longer exists.', 401)
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

// Restrict to certain roles
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

// Forgot password
export const forgotPassword = async (req, res, next) => {
  try {
    // 1) Get user based on POSTed email
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      return next(new AppError('There is no user with that email address.', 404));
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
    
    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        template: 'password-reset',
        context: {
          name: user.username,
          resetURL
        }
      });

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(
        new AppError('There was an error sending the email. Try again later!'),
        500
      );
    }
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (req, res, next) => {
  try {
    // 1) Get user based on the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Sequelize.Op.gt]: Date.now() }
      }
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // 3) Update changedPasswordAt property for the user
    // 4) Log the user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// Update password
export const updatePassword = async (req, res, next) => {
  try {
    // 1) Get user from collection
    const user = await User.scope('withPassword').findByPk(req.user.id);

    // 2) Check if POSTed current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
      return next(new AppError('Your current password is wrong.', 401));
    }

    // 3) If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// Verify email
export const verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { [Sequelize.Op.gt]: Date.now() }
      }
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully!'
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
export const resendVerificationEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { email: req.body.email }
    });

    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    if (user.emailVerified) {
      return next(new AppError('Email is already verified', 400));
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/verify-email/${verificationToken}`;
    
    await sendEmail({
      email: user.email,
      subject: 'Verify your email',
      template: 'email-verification',
      context: {
        name: user.username,
        verificationUrl
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent!'
    });
  } catch (error) {
    next(error);
  }
};

// Generate 2FA secret
export const setup2FA = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (user.twoFAEnabled) {
      return next(new AppError('2FA is already enabled for this account', 400));
    }

    const secret = await user.create2FASecret();
    await user.save({ validateBeforeSave: false });

    // In a real app, you would use a QR code library to generate a QR code
    // and send it to the client along with the secret
    res.status(200).json({
      status: 'success',
      data: {
        secret,
        qrCodeUrl: `otpauth://totp/SecureChat:${user.email}?secret=${secret}&issuer=SecureChat`
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify 2FA token
export const verify2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user.twoFASecret) {
      return next(new AppError('2FA is not set up for this account', 400));
    }

    const isTokenValid = await user.verify2FAToken(token);
    
    if (!isTokenValid) {
      return next(new AppError('Invalid token', 401));
    }

    // In a real app, you would generate a JWT with 2FA claim
    res.status(200).json({
      status: 'success',
      message: '2FA verification successful'
    });
  } catch (error) {
    next(error);
  }
};

// Disable 2FA
export const disable2FA = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.twoFAEnabled) {
      return next(new AppError('2FA is not enabled for this account', 400));
    }

    user.twoFAEnabled = false;
    user.twoFASecret = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: '2FA has been disabled for your account'
    });
  } catch (error) {
    next(error);
  }
};
