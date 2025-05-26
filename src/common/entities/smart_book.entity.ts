import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  //   OneToOne,
  //   JoinColumn,
  //   BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('smart_book')
export class SmartBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  href: string;

  @Column({ nullable: true })
  image: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  originalPrice: string;

  @Column({ nullable: true })
  discountedPrice: string;

  @Column('simple-array', { nullable: true })
  author: string[];

  @Column({ nullable: true })
  jobId: string;

  @Column({ nullable: true })
  search: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  summary: string;

  @Column({ type: 'float', nullable: true })
  relevance_score: number;

  @Column({ type: 'float', nullable: true })
  discount_amount: number;

  @Column({ type: 'float', nullable: true })
  value_score: number;

  @Column({ type: 'float', nullable: true })
  discount_percent: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
