import { Test, TestingModule } from '@nestjs/testing';
import { CkbService } from './ckb.service';

describe('CkbService', () => {
  let service: CkbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CkbService],
    }).compile();

    service = module.get<CkbService>(CkbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
