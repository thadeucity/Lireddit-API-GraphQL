import isAuth from '../middlewares/isAuth';
import { MyContext } from '../types';
import {
  Arg,
  Query,
  Mutation,
  Resolver,
  InputType,
  Field,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
  ObjectType,
} from 'type-graphql';
import { Post } from '../entities/Post';
import { getConnection } from 'typeorm';
import { Updoot } from '../entities/Updoot';
import { User } from '../entities/User';

// import { MyContext } from '../types';

@InputType()
class PostInput {
  @Field()
  title: string;

  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creator_id);
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { updootLoader, req }: MyContext,
  ) {
    if (!req.session.userId) return null;

    const updoot = await updootLoader.load({
      post_id: post.id,
      user_id: req.session.userId,
    });
    return updoot?.value || null;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext,
  ) {
    const isUpdoot = value !== -1;
    const safeValue = isUpdoot ? 1 : -1;

    const { userId } = req.session;

    const sameUpdoot = await Updoot.findOne({
      where: { post_id: postId, user_id: userId },
    });

    if (sameUpdoot && sameUpdoot.value === safeValue) return true;

    if (Number.isNaN(Number(postId)) || Number.isNaN(Number(userId))) {
      return false;
    }

    if (sameUpdoot && sameUpdoot.value !== safeValue) {
      await getConnection().transaction(async tm => {
        await tm.query(
          `
          update updoot
          set value = $1
          where post_id  = $2 and user_id = $3
        `,
          [safeValue, postId, userId],
        );

        await tm.query(
          `
            update post
            set points = points + $1 - $2
            where id = $3;
          `,
          [safeValue, sameUpdoot.value, postId],
        );
      });

      return true;
    }

    // await Updoot.insert({
    //   user_id: userId,
    //   post_id: postId,
    //   value: safeValue,
    // });

    await getConnection().transaction(async tm => {
      await tm.query(
        `
        insert into updoot ("user_id", "post_id", value)
        values ($1,$2,$3);
      `,
        [userId, postId, safeValue],
      );

      await tm.query(
        `
          update post
          set points = points + $1
          where id = $2;
        `,
        [safeValue, postId],
      );
    });

    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext,
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);

    const replacements: any[] = [realLimit + 1];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*
    from post p
    ${cursor ? `where p.created_at < $2` : ''}
    order by p."created_at" DESC
    limit $1
    `,
      replacements,
    );

    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length > realLimit,
    };
  }

  @Query(() => Post, { nullable: true })
  async post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('input') input: PostInput,
    @Ctx() { req }: MyContext,
  ): Promise<Post> {
    if (!req.session.userId) {
      throw new Error('not Authenticated');
    }

    return Post.create({
      ...input,
      creator_id: req.session.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext,
  ): Promise<Post | null> {
    const post = (await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and creator_id = :creator_id', {
        id,
        creator_id: req.session.userId,
      })
      .returning('*')
      .execute()) as any;

    return post.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext,
  ): Promise<boolean> {
    const post = await Post.findOne(id);

    if (!post) {
      return false;
    }
    if (post.creator_id !== req.session.userId) {
      throw new Error('not autorized');
    }

    await Post.delete({ id });

    return true;
  }
}
