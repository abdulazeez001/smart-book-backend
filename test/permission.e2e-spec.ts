import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from './../src/app.module';
import { Permission } from '../src/permissions/entities/permission.entity';
import { Repository } from 'typeorm';
import { CreatePermissionDto } from 'src/permissions/dto/create-permission.dto';

const payload: CreatePermissionDto = {
  name: 'create:Role',
  subject_class: 'Role',
  action: 'create',
  description: 'Can create Roles',
};
const seed_permission = {
  name: 'create:Role',
  subject_class: 'Role',
  slug: 'create:role',
  action: 'create',
  description: 'Can create Roles',
};
const bulk_payload = { permissions: [payload] };
const internal_api_key: string = process.env.SMART_BOOK_INTERNAL_API_KEY || '';
const invalidId = 'f03a8941-e89f-4063-8895-243668fd02e1';

describe('PermissionController (e2e)', () => {
  let app: INestApplication;
  let permissionRepository: Repository<Permission>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    permissionRepository = moduleFixture.get<Repository<Permission>>(
      getRepositoryToken(Permission),
    );
  });

  afterEach(async () => {
    await permissionRepository.query(
      'TRUNCATE TABLE "permission" RESTART IDENTITY CASCADE;',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  //   describe('/api/v1/permissions (POST)', () => {
  it('should create a permission', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions')
      .set('x-internal-api-key', internal_api_key)
      .send(payload)
      .expect(201);

    expect(response.body.response.name).toBe(payload.name);
    expect(response.body.message).toBe('Permission created successfully!');
  });

  it('should return conflict if permission already exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions')
      .set('x-internal-api-key', internal_api_key)
      .send(payload)
      .expect(409);
    expect(response.body.message).toBe(
      'Permission with this name already exists',
    );
  });

  it('should return unauthorized if api key is not set', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions')
      .send(payload)
      .expect(401);
    expect(response.body.message).toBe('Invalid API Key');
  });
  //   });

  //   describe('/api/v1/permissions/bulk (POST)', () => {
  it('should create multiple permissions', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/bulk')
      .set('x-internal-api-key', internal_api_key)
      .send(bulk_payload)
      .expect(201);

    expect(response.body.response).toBeInstanceOf(Array);
    expect(response.body.response[0].name).toBe(payload.name);
    expect(response.body.message).toBe('Permissions created successfully!');
  });

  it('should return conflict if some permissions already exists', async () => {
    // create permission first
    await permissionRepository.save(
      permissionRepository.create(seed_permission),
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/bulk')
      .set('x-internal-api-key', internal_api_key)
      .send(bulk_payload)
      .expect(409);
    expect(response.body.message).toBe('Some permissions already exists');
  });

  it('should return unauthorized if api key is not set', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/permissions/bulk')
      .send(bulk_payload)
      .expect(401);
    expect(response.body.message).toBe('Invalid API Key');
  });
  //   });

  //   describe('/api/v1/permissions (GET)', () => {
  it('should get all permissions', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/permissions')
      .expect(200);

    expect(response.body.response).toBeInstanceOf(Array);
    expect(response.body.message).toBe('Permissions retrieved successfully!');
  });
  //   });

  //   describe('/api/v1/permissions/:permission_id (GET)', () => {
  it('should get a specific permission by ID', async () => {
    // create permission first
    const permission = await permissionRepository.save(
      permissionRepository.create(seed_permission),
    );
    const response = await request(app.getHttpServer())
      .get(`/api/v1/permissions/${permission.id}`)
      .expect(200);

    expect(response.body.response.name).toBe(permission.name);
    expect(response.body.message).toBe('Permission retrieved successfully!');
  });

  it('should return 404 if permission is not found', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/permissions/${invalidId}`)
      .expect(404);

    expect(response.body.message).toBe('Permission not found');
  });
  //   });

  //   describe('/api/v1/permissions/:permission_id (PUT)', () => {
  it('should update a permission', async () => {
    // create permission first
    const permission = await permissionRepository.save(
      permissionRepository.create(seed_permission),
    );
    const update_payload = {
      description: 'Updated permission to update user data',
    };

    const response = await request(app.getHttpServer())
      .put(`/api/v1/permissions/${permission.id}`)
      .set('x-internal-api-key', internal_api_key)
      .send(update_payload)
      .expect(200);

    expect(response.body.response.description).toBe(update_payload.description);
    expect(response.body.message).toBe('Permission updated successfully!');
  });

  it('should return 404 if permission to update is not found', async () => {
    const update_payload = {
      description: 'Updated permission to update user data',
    };
    const response = await request(app.getHttpServer())
      .put(`/api/v1/permissions/${invalidId}`)
      .set('x-internal-api-key', internal_api_key)
      .send(update_payload)
      .expect(404);
    expect(response.body.message).toBe('Permission not found');
  });

  it('should return unauthorized if api key is not set', async () => {
    const update_payload = {
      description: 'Updated permission to update user data',
    };
    const permission_id = 'f03a8941-e89f-4063-8895-243668fd02e1';
    const response = await request(app.getHttpServer())
      .put(`/api/v1/permissions/${permission_id}`)
      .send(update_payload)
      .expect(401);
    expect(response.body.message).toBe('Invalid API Key');
  });
  //   });

  //   describe('/api/v1/permissions/:permission_id (DELETE)', () => {
  it('should delete a permission', async () => {
    // create permission first
    const permission = await permissionRepository.save(
      permissionRepository.create(seed_permission),
    );

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/permissions/${permission.id}`)
      .set('x-internal-api-key', internal_api_key)
      .expect(200);

    expect(response.body.response).toBe(1);
    expect(response.body.message).toBe('Permission removed successfully!');
  });

  it('should return 404 if permission to delete is not found', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/permissions/${invalidId}`)
      .set('x-internal-api-key', internal_api_key)
      .expect(404);
    expect(response.body.message).toBe('Permission not found');
  });

  it('should return unauthorized if api key is not set', async () => {
    const permission_id = 'f03a8941-e89f-4063-8895-243668fd02e1';
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/permissions/${permission_id}`)
      .expect(401);
    expect(response.body.message).toBe('Invalid API Key');
  });
  //   });
});
