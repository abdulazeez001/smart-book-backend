// import { Test, TestingModule } from '@nestjs/testing';
// import { INestApplication } from '@nestjs/common';
// import * as request from 'supertest';
// import { getRepositoryToken } from '@nestjs/typeorm';
// import { AppModule } from './../src/app.module';
// import { User } from '../src/users/entities/user.entity';
// import { Role } from '../src/roles/entities/role.entity';
// import { Permission } from '../src/permissions/entities/permission.entity';
// import { Repository } from 'typeorm';
// import { CreateUserDto } from '../src/users/dto/create-user.dto';
// // import { delay } from '../src/common/helpers';

// const createUserDto: CreateUserDto = {
//   user: {
//     email: 'prospero@-global.com',
//     password: 'Password123##',
//     confirm_password: 'Password123##',
//     first_name: 'Prosper',
//     last_name: 'Eravwuvieke',
//     prefix: 'Prof.',
//     suffix: 'I',
//     country_code: '+234',
//     phone_number: '123-456-7890',
//     image:
//       'https://robohash.org/consequunturcommodivoluptatem.png?size=300x300&set=set1',
//     gender: 'Male',
//     organizations_attributes: [
//       {
//         name: 'Lifes Church International',
//         industry: 'Church',
//       },
//     ],
//   },
// };
// const role = {
//   name: 'account_owner',
//   slug: 'account_owner',
//   description: 'Account Owner - Super Admin',
// };
// const user_id = 'user_qwe123rgyoDaW';
// const role_id = 'role_qwe123rgyoDaW';
// describe('UserController (e2e)', () => {
//   let app: INestApplication;
//   let userRepository: Repository<User>;
//   let roleRepository: Repository<Role>;
//   let permissionRepository: Repository<Permission>;

//   beforeEach(async () => {
//     const moduleFixture: TestingModule = await Test.createTestingModule({
//       imports: [AppModule],
//     }).compile();

//     app = moduleFixture.createNestApplication();
//     await app.init();
//     userRepository = moduleFixture.get<Repository<User>>(
//       getRepositoryToken(User),
//     );
//     roleRepository = moduleFixture.get<Repository<Role>>(
//       getRepositoryToken(Role),
//     );
//     permissionRepository = moduleFixture.get<Repository<Permission>>(
//       getRepositoryToken(Permission),
//     );
//   });

//   afterEach(async () => {
//     await userRepository.query(
//       'TRUNCATE TABLE "user_organizations" RESTART IDENTITY CASCADE;',
//     );
//     // await userRepository.query(
//     //   'TRUNCATE TABLE "user_roles" RESTART IDENTITY CASCADE;',
//     // );
//     await roleRepository.query(
//       'TRUNCATE TABLE "role_permissions" RESTART IDENTITY CASCADE;',
//     );

//     await userRepository.query(
//       'TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;',
//     ); // Clear the table after each test
//     await roleRepository.query(
//       'TRUNCATE TABLE "role" RESTART IDENTITY CASCADE;',
//     );
//     await permissionRepository.query(
//       'TRUNCATE TABLE "permission" RESTART IDENTITY CASCADE;',
//     );
//   });

//   afterAll(async () => {
//     await app.close();
//   });

//   it('/users (GET)', async () => {
//     const response = await request(app.getHttpServer())
//       .get('/users')
//       .expect(200);
//     expect(response.body.response).toHaveProperty('docs');
//     expect(response.body.response).toHaveProperty('pagination');
//   });

//   it('/users/register (POST) - should create a new user', async () => {
//     const permission = await permissionRepository.save(
//       permissionRepository.create({
//         name: 'create:Role',
//         slug: 'create:role',
//         subject_class: 'Role',
//         action: 'create',
//         description: 'Can create Roles',
//       }),
//     );
//     await roleRepository.save(
//       roleRepository.create({
//         role_id,
//         ...role,
//         permissions: [permission],
//       }),
//     );
//     const response = await request(app.getHttpServer())
//       .post('/users/register')
//       .send(createUserDto)
//       .expect(201);

//     expect(response.body.response).toHaveProperty('user_id');
//     expect(response.body.response).not.toHaveProperty('password');
//     expect(response.body.response.first_name).toBe(
//       createUserDto.user.first_name,
//     );
//     expect(response.body.response.email).toBe(createUserDto.user.email);
//   });

//   it('/users/register (POST) - should return conflict if user already exists', async () => {
//     // Create a user first
//     createUserDto.user.gender = createUserDto.user.gender.toLowerCase();
//     await userRepository.save(
//       userRepository.create({
//         ...createUserDto.user,
//         user_id,
//         encrypted_password: createUserDto.user.password,
//       }),
//     );

//     const response = await request(app.getHttpServer())
//       .post('/users/register')
//       .send(createUserDto)
//       .expect(409);

//     expect(response.body.message).toBe('A user with this email already exists');
//   });

//   it('/users/:id (GET) - should return a user by ID', async () => {
//     createUserDto.user.gender = createUserDto.user.gender.toLowerCase();
//     const createdUser = await userRepository.save(
//       userRepository.create({
//         ...createUserDto.user,
//         user_id,
//         encrypted_password: createUserDto.user.password,
//       }),
//     );

//     const response = await request(app.getHttpServer())
//       .get(`/users/${createdUser.user_id}`)
//       .expect(200);

//     expect(response.body.response).toHaveProperty(
//       'user_id',
//       createdUser.user_id,
//     );
//     expect(response.body.response.email).toBe(createdUser.email);
//   });

//   it('/users/:id (PUT) - should update a user by ID', async () => {
//     createUserDto.user.gender = createUserDto.user.gender.toLowerCase();
//     const createdUser = await userRepository.save(
//       userRepository.create({
//         ...createUserDto.user,
//         user_id,
//         encrypted_password: createUserDto.user.password,
//       }),
//     );

//     const updateUserDto = {
//       first_name: 'Janet',
//     };

//     const response = await request(app.getHttpServer())
//       .put(`/users/${createdUser.user_id}`)
//       .send(updateUserDto)
//       .expect(200);

//     expect(response.body.response.first_name).toBe(updateUserDto.first_name);

//     const updatedUser = await userRepository.findOneBy({
//       user_id: createdUser.user_id,
//     });
//     expect(updatedUser?.first_name).toBe(updateUserDto.first_name);
//   });

//   it('/users/:id (DELETE) - should delete a user by ID', async () => {
//     createUserDto.user.gender = createUserDto.user.gender.toLowerCase();
//     const createdUser = await userRepository.save(
//       userRepository.create({
//         ...createUserDto.user,
//         user_id,
//         encrypted_password: createUserDto.user.password,
//       }),
//     );

//     await request(app.getHttpServer())
//       .delete(`/users/${createdUser.user_id}`)
//       .expect(200);

//     const deletedUser = await userRepository.findOneBy({
//       user_id: createdUser.user_id,
//     });
//     expect(deletedUser).toBeNull();
//   });
// });
