/**
 * Validation Middleware Tests
 */

const { schemas, validateBody, validateParams } = require('../../middleware/validation');

describe('Validation Schemas', () => {
    describe('loginSchema', () => {
        it('should pass valid login data', () => {
            const result = schemas.login.safeParse({
                username: 'testuser',
                password: 'password123'
            });
            expect(result.success).toBe(true);
        });

        it('should fail with empty username', () => {
            const result = schemas.login.safeParse({
                username: '',
                password: 'password123'
            });
            expect(result.success).toBe(false);
        });

        it('should fail with missing password', () => {
            const result = schemas.login.safeParse({
                username: 'testuser'
            });
            expect(result.success).toBe(false);
        });

        it('should trim whitespace from username', () => {
            const result = schemas.login.safeParse({
                username: '  testuser  ',
                password: 'password123'
            });
            expect(result.success).toBe(true);
            expect(result.data.username).toBe('testuser');
        });
    });

    describe('createUserSchema', () => {
        // Password must have: 8+ chars, uppercase, lowercase, number
        const validPassword = 'SecurePass123';
        
        it('should pass valid user data', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: validPassword,
                role: 'Operator'
            });
            expect(result.success).toBe(true);
        });

        it('should fail with short password', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: '123',
                role: 'Operator'
            });
            expect(result.success).toBe(false);
        });

        it('should fail with password missing uppercase', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: 'securepass123' // no uppercase
            });
            expect(result.success).toBe(false);
        });

        it('should default role to Operator', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: validPassword
            });
            expect(result.success).toBe(true);
            expect(result.data.role).toBe('Operator');
        });

        it('should accept valid email', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: validPassword,
                email: 'user@example.com'
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = schemas.createUser.safeParse({
                username: 'newuser',
                name: 'New User',
                password: validPassword,
                email: 'not-an-email'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('customerSchema', () => {
        it('should pass valid customer data', () => {
            const result = schemas.customer.safeParse({
                name: 'Acme Corporation',
                address: '123 Main Street',
                phone: '555-1234',
                terms: 'Net 30'
            });
            expect(result.success).toBe(true);
        });

        it('should fail with empty name', () => {
            const result = schemas.customer.safeParse({
                name: '',
                address: '123 Main Street'
            });
            expect(result.success).toBe(false);
        });

        it('should allow optional fields to be missing', () => {
            const result = schemas.customer.safeParse({
                name: 'Simple Customer'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('materialSchema', () => {
        it('should pass valid material data', () => {
            const result = schemas.material.safeParse({
                name: 'Aluminum Bar 6061',
                part_number: 'ALU-6061-2X4',
                category: 'raw_material',
                qty_on_hand: 10,
                minimum_qty: 5,
                unit_price: 25.50
            });
            expect(result.success).toBe(true);
        });

        it('should default quantity to 0', () => {
            const result = schemas.material.safeParse({
                name: 'New Material'
            });
            expect(result.success).toBe(true);
            expect(result.data.qty_on_hand).toBe(0);
            expect(result.data.minimum_qty).toBe(0);
        });

        it('should reject negative quantities', () => {
            const result = schemas.material.safeParse({
                name: 'Bad Material',
                qty_on_hand: -5
            });
            expect(result.success).toBe(false);
        });
    });

    describe('idParamSchema', () => {
        it('should pass valid numeric ID', () => {
            const result = schemas.idParam.safeParse({ id: '123' });
            expect(result.success).toBe(true);
            expect(result.data.id).toBe(123);
        });

        it('should fail with non-numeric ID', () => {
            const result = schemas.idParam.safeParse({ id: 'abc' });
            expect(result.success).toBe(false);
        });

        it('should fail with negative ID', () => {
            const result = schemas.idParam.safeParse({ id: '-1' });
            expect(result.success).toBe(false);
        });
    });

    describe('updateUserSchema', () => {
        it('should allow partial updates', () => {
            const result = schemas.updateUser.safeParse({
                name: 'Updated Name'
            });
            expect(result.success).toBe(true);
        });

        it('should validate email if provided', () => {
            const result = schemas.updateUser.safeParse({
                email: 'invalid-email'
            });
            expect(result.success).toBe(false);
        });

        it('should validate password requirements if provided', () => {
            const result = schemas.updateUser.safeParse({
                password: 'weak'
            });
            expect(result.success).toBe(false);
        });

        it('should allow null email', () => {
            const result = schemas.updateUser.safeParse({
                email: null
            });
            expect(result.success).toBe(true);
        });
    });

    describe('quoteSchema', () => {
        it('should pass valid quote data', () => {
            const result = schemas.quote.safeParse({
                customer_id: 1,
                quantity: 100,
                part_number: 'PART-001'
            });
            expect(result.success).toBe(true);
        });

        it('should require customer_id', () => {
            const result = schemas.quote.safeParse({
                quantity: 50
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-positive customer_id', () => {
            const result = schemas.quote.safeParse({
                customer_id: -1,
                quantity: 50
            });
            expect(result.success).toBe(false);
        });

        it('should default quantity to 1', () => {
            const result = schemas.quote.safeParse({
                customer_id: 1
            });
            expect(result.success).toBe(true);
            expect(result.data.quantity).toBe(1);
        });
    });

    describe('workOrderSchema', () => {
        it('should pass valid work order data', () => {
            const result = schemas.workOrder.safeParse({
                customer_id: 1,
                notes: 'Test notes'
            });
            expect(result.success).toBe(true);
        });

        it('should require customer_id', () => {
            const result = schemas.workOrder.safeParse({
                notes: 'Test notes'
            });
            expect(result.success).toBe(false);
        });

        it('should allow optional quote_id', () => {
            const result = schemas.workOrder.safeParse({
                customer_id: 1,
                quote_id: 5
            });
            expect(result.success).toBe(true);
        });

        it('should allow null quote_id', () => {
            const result = schemas.workOrder.safeParse({
                customer_id: 1,
                quote_id: null
            });
            expect(result.success).toBe(true);
        });
    });

    describe('contactSchema', () => {
        it('should pass valid contact data', () => {
            const result = schemas.contact.safeParse({
                name: 'John Doe',
                email: 'john@example.com',
                phone: '555-1234'
            });
            expect(result.success).toBe(true);
        });

        it('should require name', () => {
            const result = schemas.contact.safeParse({
                email: 'john@example.com'
            });
            expect(result.success).toBe(false);
        });

        it('should validate email format', () => {
            const result = schemas.contact.safeParse({
                name: 'John Doe',
                email: 'not-valid'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('updatePermissionsSchema', () => {
        it('should pass valid permissions', () => {
            const result = schemas.updatePermissions.safeParse({
                tab_permissions: {
                    dashboard: true,
                    workcenter: true,
                    inventory: false,
                    sales: false,
                    tasks: true,
                    settings: false
                }
            });
            expect(result.success).toBe(true);
        });

        it('should allow partial permissions', () => {
            const result = schemas.updatePermissions.safeParse({
                tab_permissions: {
                    inventory: true
                }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('appearanceSettingsSchema', () => {
        it('should pass valid appearance settings', () => {
            const result = schemas.appearanceSettings.safeParse({
                appearance_settings: {
                    theme: 'dark',
                    showGrid: true,
                    showGlow: false,
                    animations: true,
                    transparency: 75
                }
            });
            expect(result.success).toBe(true);
        });

        it('should reject transparency out of range', () => {
            const result = schemas.appearanceSettings.safeParse({
                appearance_settings: {
                    transparency: 150
                }
            });
            expect(result.success).toBe(false);
        });

        it('should reject negative transparency', () => {
            const result = schemas.appearanceSettings.safeParse({
                appearance_settings: {
                    transparency: -10
                }
            });
            expect(result.success).toBe(false);
        });
    });
});

describe('Validation Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = { body: {}, params: {}, query: {} };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
    });

    describe('validateBody', () => {
        it('should call next() for valid data', () => {
            const middleware = validateBody(schemas.login);
            mockReq.body = { username: 'test', password: 'password123' };

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid data', () => {
            const middleware = validateBody(schemas.login);
            mockReq.body = { username: '' };

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.any(String)
                })
            );
        });
    });

    describe('validateParams', () => {
        it('should call next() for valid params', () => {
            const middleware = validateParams(schemas.idParam);
            mockReq.params = { id: '42' };

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.params.id).toBe(42); // Coerced to number
        });

        it('should return 400 for invalid params', () => {
            const middleware = validateParams(schemas.idParam);
            mockReq.params = { id: 'not-a-number' };

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });
});
