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

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  isbn10: string;

  @Column({ nullable: true })
  isbn13: string;

  @Column({ nullable: true })
  publisher: string;

  @Column({ nullable: true })
  publicationDate: string;

  @Column({ nullable: true })
  printLength: string;

  @Column({ nullable: true })
  language: string;

  @Column({ nullable: true })
  dimensions: string;

  @Column('simple-array', { nullable: true })
  author: string[];

  @Column({ nullable: true })
  jobId: string;

  @Column({ nullable: true })
  search: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  price: string;

  @Column({ nullable: true })
  stock: string;

  @Column({ nullable: true })
  printlength: string;

  @Column({ nullable: true })
  publicationdate: string;

  @Column({ nullable: true, name: 'isbn-10' })
  isbn_10: string;

  @Column({ nullable: true, name: 'isbn-13' })
  isbn_13: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  rating: string;

  @Column({ nullable: true })
  ratingCount: string;

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
