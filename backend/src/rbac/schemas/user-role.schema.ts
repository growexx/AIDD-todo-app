import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserRoleDocument = UserRole & Document;

/**
 * Maps userId (external user _id as string) to a Role.
 * Keeps RBAC module independent from the User model.
 */
@Schema({ timestamps: false })
export class UserRole {
  @Prop({ required: true, type: String })
  userId: string;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  roleId: Types.ObjectId;

  @Prop({ default: Date.now })
  assignedAt: Date;
}

export const UserRoleSchema = SchemaFactory.createForClass(UserRole);
UserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });
UserRoleSchema.index({ userId: 1 });
