import { Sequelize } from 'sequelize';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        dialectOptions: {
          ssl: process.env.NODE_ENV === 'production' 
            ? { require: true, rejectUnauthorized: false }
            : false,
          connectTimeout: 60000
        },
        define: {
          timestamps: true,
          underscored: true,
          paranoid: true,
          defaultScope: {
            attributes: {
              exclude: ['deletedAt']
            }
          }
        }
      }
    );

    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // Sync all models
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
    }
    
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

// Export the database connection for use in models
export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' 
        ? { require: true, rejectUnauthorized: false }
        : false
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true
    }
  }
);
