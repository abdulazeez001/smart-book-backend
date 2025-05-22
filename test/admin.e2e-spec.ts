import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Adjust to your actual module path
import { CreateAdminDto } from '../src/admins/dto/complete-admin-signup.dto'; // Adjust to the correct path

describe('AdminsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Import the main AppModule to initialize the full application
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close(); // Close the app after tests are done
  });

  it('/api/v1/admin/users/register (POST) - should create an admin', async () => {
    const createAdminDto: CreateAdminDto = {
      email: 'jackie@gmail.com',
      password: 'my-password9',
      confirm_password: 'my-password9',
      first_name: 'Jackie',
      last_name: 'Chan',
      country_code: '234',
      phone_number: '8012345678',
      gender: 'male',
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/users/register')
      .send(createAdminDto)
      .expect(201); // Expecting the status code to be 201 (Created)

    expect(response.body).toHaveProperty('response');
    expect(response.body.response).toHaveProperty('email', 'jackie@gmail.com');
    expect(response.body.response).toHaveProperty('first_name', 'Jackie');
    expect(response.body.response).toHaveProperty('last_name', 'Chan');
    expect(response.body.message).toBe('Admin created successfully!');
  });
});
