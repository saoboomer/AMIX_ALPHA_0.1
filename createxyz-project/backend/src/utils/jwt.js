import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { promisify } from 'util';
import { AppError } from './error.js';

// Convert jwt.verify to use promises
const verifyJwt = promisify(jwt.verify);

// Generate JWT token
export const signToken = (id) => {
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

// Generate refresh token
export const signRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER || 'secure-chat-api'
    }
  );
};

// Verify JWT token
export const verifyToken = async (token, isRefresh = false) => {
  try {
    const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    return await verifyJwt(token, secret, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'secure-chat-api'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Your token has expired! Please log in again.', 401);
    }
    throw new AppError('Invalid token. Please log in again!', 401);
  }
};

// Generate random token for email verification, password reset, etc.
export const generateRandomToken = (bytes = 32) => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(bytes, (err, buffer) => {
      if (err) {
        reject(new AppError('Error generating token', 500));
      }
      const token = buffer.toString('hex');
      resolve(token);
    });
  });
};

// Create hashed token for database storage
export const createHashedToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

// Generate token and set cookie
export const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  
  // Remove password from output
  user.password = undefined;
  
  // Cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
  };

  // Set secure flag in production
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);
  
  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    expires: new Date(
      Date.now() + process.env.JWT_REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000
    )
  });

  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    data: {
      user
    }
  });
};

// Generate token for WebSocket authentication
export const generateSocketToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SOCKET_SECRET || process.env.JWT_SECRET,
    { 
      expiresIn: '1h',
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER || 'secure-chat-api'
    }
  );
};
