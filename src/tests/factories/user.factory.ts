import { faker } from '@faker-js/faker'

export const createFakeUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  role: 'supplier' as const,
  created_at: faker.date.past().toISOString(),
  ...overrides,
})

export const createFakeProfile = (userId: string, overrides = {}) => ({
  user_id: userId,
  name: faker.person.fullName(),
  phone: faker.phone.number(),
  business_name: faker.company.name(),
  city: faker.location.city(),
  avatar_url: null,
  ...overrides,
})

export const createFakeSupplier = (userId: string, overrides = {}) => ({
  id: faker.string.uuid(),
  user_id: userId,
  description: faker.company.catchPhrase(),
  delivery_areas: [faker.location.city()],
  is_active: true,
  created_at: faker.date.past().toISOString(),
  ...overrides,
})
