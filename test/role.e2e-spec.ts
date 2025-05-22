import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Assuming you have an AppModule
import { CreateRoleDto } from '../src/roles/dto/create-role.dto';
import { UpdateRoleDto } from '../src/roles/dto/update-role.dto';

const internal_api_key: string = process.env.SMART_BOOK_INTERNAL_API_KEY || '';
describe('RolesController (e2e)', () => {
  let app: INestApplication;
  let createdRoleId: string; // For storing the ID of the role to test update and delete

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/roles (POST) - Create Role', async () => {
    const createRoleDto: CreateRoleDto = {
      name: 'account_owners',
      description: 'Account Owner - Super Admin',
      permissions: [],
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .send(createRoleDto)
      .set('x-internal-api-key', internal_api_key)
      .expect(201);

    expect(response.body.response).toHaveProperty('role_id');
    expect(response.body.message).toBe('Role created successfully!');

    // Store the role ID for later tests
    createdRoleId = response.body.response.role_id;
  });

  it('/api/v1/roles (GET) - Get All Roles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .expect(200);

    expect(Array.isArray(response.body.response)).toBe(true);
    expect(response.body.message).toBe('Roles retrieved successfully!');
  });

  it('/api/v1/roles/:role_id (GET) - Get a Role', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/roles/${createdRoleId}`)
      .expect(200);

    expect(response.body.response).toHaveProperty('role_id', createdRoleId);
    expect(response.body.message).toBe('Role retrieved successfully!');
  });

  it('/api/v1/roles/:role_id (PUT) - Update a Role', async () => {
    const updateRoleDto: UpdateRoleDto = {
      name: 'Admin Updated',
      description: 'Updated administrator role',
    };

    const response = await request(app.getHttpServer())
      .put(`/api/v1/roles/${createdRoleId}`)
      .send(updateRoleDto)
      .set('x-internal-api-key', internal_api_key)
      .expect(200);

    expect(response.body.response).toHaveProperty('role_id', createdRoleId);
    expect(response.body.message).toBe('Role updated successfully!');
  });

  it('/api/v1/roles/:role_id (DELETE) - Remove a Role', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/roles/${createdRoleId}`)
      .set('x-internal-api-key', internal_api_key)
      .expect(200);

    expect(response.body.message).toBe('Role removed successfully!');
  });
});
