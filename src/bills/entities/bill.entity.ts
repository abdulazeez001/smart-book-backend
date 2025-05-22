import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  job_id: string;

  @Column()
  search: string;

  @Column({ type: 'bigint', nullable: false })
  processed_data: number;

  @Column({ type: 'bigint', nullable: false })
  total_expected_data: number;

  @Column({
    enum: ['processing', 'failed', 'success'],
    default: 'processing',
  })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
