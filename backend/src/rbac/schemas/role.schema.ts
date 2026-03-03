import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoleDocument = Role & Document;

/**
 * Role schema: identifier and optional description.
 * permissions array is populated on read.
 */
@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Role {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }], default: [] })
  permissions: Types.ObjectId[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ name: 1 }, { unique: true });
