/**
 * Barrel export of all main-process services.
 * Import from here to keep call sites clean.
 */

export { rootLogger, ConsoleLogger, setLogLevel } from './logging/Logger';
export { getStorage, LocalStorageProvider } from './storage/LocalStorageProvider';
export { getFFmpeg, StubFFmpegService } from './ffmpeg/FFmpegService';
export { getJobQueue, InMemoryJobQueue } from './queue/JobQueue';
export { getProjectService, JsonProjectService } from './project/ProjectService';
export { getCache, FileCacheService } from './cache/CacheService';
export { getSecurity, DefaultSecurityService } from './security/SecurityService';
export { getAudioService, DefaultAudioService } from './audio/AudioService';
export { getImageService, DefaultImageService } from './image/ImageService';
export { getAIService, setAIService, LocalStubAIService } from './ai/AIService';

export { getAuthService, LocalAuthService } from './auth/AuthService';

export { getBillingService, BillingService } from './billing/BillingService';
