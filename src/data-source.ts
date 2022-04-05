import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  logging: true,
  entities: ['dist/entities/*.js'],
  migrations: ['dist/migrations/*.js'],
});
