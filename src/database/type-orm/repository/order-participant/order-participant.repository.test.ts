import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITY_MANAGER_KEY } from '@src/core/constant';
import { NotExistDataException } from '@src/core/exception';
import { OrderSenderReceiverDto } from '@src/router/order-sender-receiver/dto/order-sender-receiver.dto';
import { plainToInstance } from 'class-transformer';
import { ClsModule, ClsService, ClsServiceManager } from 'nestjs-cls';
import { EntityManager } from 'typeorm';
import { TestTypeormModule } from '../../../../../test/config/typeorm.module';
import {
  DepartureEntity,
  DestinationEntity,
  OrderEntity,
  ProductEntity,
  TransportationEntity,
  UserEntity,
} from '../../entity';
import { TransactionManager } from '../../util/transaction/transaction-manager/transaction-manager';
import { OrderParticipantRepository } from './order-participant.repository';

const createUser = async (manager: EntityManager) => {
  const user = manager.create(UserEntity, {
    id: '아이디',
    walletAddress: '지갑주소',
    name: '이름',
    email: '이메일',
    contact: '연락처',
    birthDate: {
      id: '아이디',
      date: new Date(2000, 9, 12).toISOString(),
    },
    profileImage: {
      id: '아이디',
      imageId: '111',
    },
    joinDate: {
      id: '아이디',
      date: new Date(2023, 9, 12).toISOString(),
    },
  });

  return await manager.save(UserEntity, user);
};

const createOrder = async (manager: EntityManager, requester: UserEntity) => {
  const detail = '디테일';
  const product = {
    width: 0,
    length: 0,
    height: 0,
    weight: 0,
  };
  const transportation: Partial<TransportationEntity> = {
    walking: 0,
    bicycle: 0,
    scooter: 0,
    bike: 0,
    car: 0,
    truck: 0,
  };
  const destination = {
    x: 37.5,
    y: 112,
    detail: '디테일',
  };
  const receiver = {
    name: '이름',
    phone: '01012345678',
  };
  const departure = {
    x: 0,
    y: 0,
    detail: '디테일',
  };
  const sender = {
    name: '이름',
    phone: '01012345678',
  };

  await manager.transaction(async (manager) => {
    const order = manager.create(OrderEntity, {
      detail,
      requester,
    });

    await manager.save(OrderEntity, order);

    const id = order.id;

    await manager.save(ProductEntity, {
      id,
      ...product,
      order: order,
    });
    await manager.save(TransportationEntity, {
      id,
      ...transportation,
      order: order,
    });
    await manager.save(DestinationEntity, {
      id,
      ...destination,
      order: order,
      receiver: {
        id,
        ...receiver,
      },
    });
    await manager.save(DepartureEntity, {
      id,
      ...departure,
      order: order,
      sender: {
        id,
        ...sender,
      },
    });
  });
};

describe('OrderParticipantRepository', () => {
  let testModule: TestingModule;
  let repository: OrderParticipantRepository;
  let manager: EntityManager;
  let cls: ClsService<{ [ENTITY_MANAGER_KEY]: EntityManager }>;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [
        TestTypeormModule,
        TypeOrmModule.forFeature([
          OrderEntity,
          UserEntity,
          ProductEntity,
          TransportationEntity,
          DestinationEntity,
          DepartureEntity,
          ClsModule,
        ]),
      ],
      providers: [OrderParticipantRepository, TransactionManager],
    }).compile();

    repository = testModule.get(OrderParticipantRepository);
    manager = testModule.get(EntityManager);
    cls = ClsServiceManager.getClsService();
  });

  beforeEach(async () => {
    const user = await createUser(manager);
    await createOrder(manager, user);
  });

  afterEach(async () => {
    await manager.clear(OrderEntity);
  });

  describe('findSenderReceiverLocationAndPhoneNumberByOrderId', () => {
    test('통과하는 테스트', async () => {
      const orderId = 1;
      const result = plainToInstance(OrderSenderReceiverDto, {
        id: orderId,
        departure: {
          x: 0,
          y: 0,
          sender: { phone: '01012345678' },
        },
        destination: {
          x: 37.5,
          y: 112,
          receiver: { phone: '01012345678' },
        },
      });

      await cls.run(async () => {
        cls.set(ENTITY_MANAGER_KEY, manager);

        await expect(
          repository.findSenderReceiverLocationAndPhoneNumberByOrderId(orderId),
        ).resolves.toEqual(result);
      });
    });

    test('실패하는 테스트, 존재하지 않는 주문 아이디를 입력하면 NotExistDataException을 던짐', async () => {
      const orderId = 32;
      const error = new NotExistDataException(orderId);

      await cls.run(async () => {
        cls.set(ENTITY_MANAGER_KEY, manager);

        await expect(
          repository.findSenderReceiverLocationAndPhoneNumberByOrderId(orderId),
        ).rejects.toStrictEqual(error);
      });
    });
  });
});
