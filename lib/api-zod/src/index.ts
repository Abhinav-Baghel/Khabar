// Zod runtime schemas (validators) take precedence under their own names.
// TypeScript-only types from `generated/types` are re-exported with a `T` prefix
// when they would otherwise collide with a Zod schema export.
export * from "./generated/api";

export {
  type CreatePostBody as TCreatePostBody,
  type LoginBody as TLoginBody,
  type RegisterBody as TRegisterBody,
  type UpdateCurrentUserBody as TUpdateCurrentUserBody,
  type RequestUploadUrlBody as TRequestUploadUrlBody,
} from "./generated/types";

export * from "./generated/types/categoryCount";
export * from "./generated/types/currentUser";
export * from "./generated/types/error";
export * from "./generated/types/healthStatus";
export * from "./generated/types/listPostsParams";
export * from "./generated/types/listTopReportersParams";
export * from "./generated/types/location";
export * from "./generated/types/post";
export * from "./generated/types/postCategory";
export * from "./generated/types/postCurrentUserVote";
export * from "./generated/types/reputationEvent";
export * from "./generated/types/saveBody";
export * from "./generated/types/saveStatus";
export * from "./generated/types/statsOverview";
export * from "./generated/types/trendingLocality";
export * from "./generated/types/user";
export * from "./generated/types/userProfile";
export * from "./generated/types/verificationStatus";
export * from "./generated/types/verifyBody";
export * from "./generated/types/voteBody";
export * from "./generated/types/voteBodyDirection";
export * from "./generated/types/checkAvailabilityParams";
export * from "./generated/types/checkAvailability200";
export * from "./generated/types/logout200";
export * from "./generated/types/requestUploadUrlResponseMetadata";
