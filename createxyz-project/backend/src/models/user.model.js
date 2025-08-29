import { DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sequelize } from '../config/db.js';
import { AppError } from '../utils/error.js';

class User extends Model {
  // Check if password is correct
  async correctPassword(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
  }

  // Check if user changed password after the token was issued
  changedPasswordAfter(JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    return false;
  }

  // Generate password reset token
  createPasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return resetToken;
  }

  // Generate email verification token
  createEmailVerificationToken() {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return verificationToken;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        is: /^[a-zA-Z0-9_]{3,30}$/,
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 100],
        isStrongPassword: function(value) {
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/.test(value)) {
            throw new Error('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');
          }
        }
      }
    },
    passwordChangedAt: DataTypes.DATE,
    passwordResetToken: DataTypes.STRING,
    passwordResetExpires: DataTypes.DATE,
    emailVerificationToken: DataTypes.STRING,
    emailVerificationExpires: DataTypes.DATE,
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFASecret: DataTypes.STRING,
    twoFAEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['user'],
      allowNull: false
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    publicKey: DataTypes.TEXT,
    privateKey: DataTypes.TEXT,
    keyFingerprint: DataTypes.STRING,
    keyExpiresAt: DataTypes.DATE
  },
  {
    sequelize,
    modelName: 'User',
    timestamps: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    }
  }
);

// Hash password before saving
User.beforeCreate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
    user.passwordChangedAt = Date.now() - 1000; // Ensure token is created after password change
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
    user.passwordChangedAt = Date.now() - 1000;
  }
});

export { User };
