import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';
import { Post } from './Post';

@Entity()
export class Updoot extends BaseEntity {
  @Column({ type: 'int' })
  value: number;

  @PrimaryColumn()
  user_id: number;

  @ManyToOne(() => User, user => user.updoots)
  user: User;

  @PrimaryColumn()
  post_id: number;

  @ManyToOne(() => Post, post => post.updoots, {
    onDelete: 'CASCADE',
  })
  post: Post;
}
