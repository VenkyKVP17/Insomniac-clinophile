declare global {
  const H3Error: typeof import('../../node_modules/h3').H3Error
  const H3Event: typeof import('../../node_modules/h3').H3Event
  const __buildAssetsURL: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/paths').buildAssetsURL
  const __publicAssetsURL: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/paths').publicAssetsURL
  const addLearnedFact: typeof import('../../server/utils/user-profile').addLearnedFact
  const appendCorsHeaders: typeof import('../../node_modules/h3').appendCorsHeaders
  const appendCorsPreflightHeaders: typeof import('../../node_modules/h3').appendCorsPreflightHeaders
  const appendHeader: typeof import('../../node_modules/h3').appendHeader
  const appendHeaders: typeof import('../../node_modules/h3').appendHeaders
  const appendResponseHeader: typeof import('../../node_modules/h3').appendResponseHeader
  const appendResponseHeaders: typeof import('../../node_modules/h3').appendResponseHeaders
  const applyPriorityBoost: typeof import('../../server/utils/notification-filter').applyPriorityBoost
  const assertMethod: typeof import('../../node_modules/h3').assertMethod
  const attachToSession: typeof import('../../server/utils/gemini-tmux').attachToSession
  const browse: typeof import('../../server/utils/browser-agent').browse
  const buildMemoryContext: typeof import('../../server/utils/memory-store').buildMemoryContext
  const buildSmartContext: typeof import('../../server/utils/context-compressor').buildSmartContext
  const cachedEventHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').cachedEventHandler
  const cachedFunction: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').cachedFunction
  const calculateTokenSavings: typeof import('../../server/utils/context-compressor').calculateTokenSavings
  const callGeminiAPI: typeof import('../../server/utils/gemini-api').callGeminiAPI
  const callGroqAPI: typeof import('../../server/utils/groq-api').callGroqAPI
  const callNodeListener: typeof import('../../node_modules/h3').callNodeListener
  const cancelUserActions: typeof import('../../server/utils/conversation-state').cancelUserActions
  const checkGeminiHealth: typeof import('../../server/utils/gemini-cli').checkGeminiHealth
  const checkSpendingVelocity: typeof import('../../server/utils/analytics').checkSpendingVelocity
  const checkTmuxHealth: typeof import('../../server/utils/gemini-tmux').checkTmuxHealth
  const cleanTempFiles: typeof import('../../server/utils/db').cleanTempFiles
  const cleanupExpiredActions: typeof import('../../server/utils/conversation-state').cleanupExpiredActions
  const clearResponseHeaders: typeof import('../../node_modules/h3').clearResponseHeaders
  const clearSession: typeof import('../../node_modules/h3').clearSession
  const closeVectorDb: typeof import('../../server/utils/vector-db').closeVectorDb
  const completePendingAction: typeof import('../../server/utils/conversation-state').completePendingAction
  const compressOldContext: typeof import('../../server/utils/context-compressor').compressOldContext
  const createApp: typeof import('../../node_modules/h3').createApp
  const createAppEventHandler: typeof import('../../node_modules/h3').createAppEventHandler
  const createEmailConfirmation: typeof import('../../server/utils/conversation-state').createEmailConfirmation
  const createError: typeof import('../../node_modules/h3').createError
  const createEvent: typeof import('../../node_modules/h3').createEvent
  const createEventStream: typeof import('../../node_modules/h3').createEventStream
  const createRouter: typeof import('../../node_modules/h3').createRouter
  const createTask: typeof import('../../server/utils/db').createTask
  const defaultContentType: typeof import('../../node_modules/h3').defaultContentType
  const defineAppConfig: typeof import('../../node_modules/@nuxt/nitro-server/dist/runtime/utils/config').defineAppConfig
  const defineCachedEventHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').defineCachedEventHandler
  const defineCachedFunction: typeof import('../../node_modules/nitropack/dist/runtime/internal/cache').defineCachedFunction
  const defineEventHandler: typeof import('../../node_modules/h3').defineEventHandler
  const defineLazyEventHandler: typeof import('../../node_modules/h3').defineLazyEventHandler
  const defineNitroErrorHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/error/utils').defineNitroErrorHandler
  const defineNitroPlugin: typeof import('../../node_modules/nitropack/dist/runtime/internal/plugin').defineNitroPlugin
  const defineNodeListener: typeof import('../../node_modules/h3').defineNodeListener
  const defineNodeMiddleware: typeof import('../../node_modules/h3').defineNodeMiddleware
  const defineRenderHandler: typeof import('../../node_modules/nitropack/dist/runtime/internal/renderer').defineRenderHandler
  const defineRequestMiddleware: typeof import('../../node_modules/h3').defineRequestMiddleware
  const defineResponseMiddleware: typeof import('../../node_modules/h3').defineResponseMiddleware
  const defineRouteMeta: typeof import('../../node_modules/nitropack/dist/runtime/internal/meta').defineRouteMeta
  const defineTask: typeof import('../../node_modules/nitropack/dist/runtime/internal/task').defineTask
  const defineWebSocket: typeof import('../../node_modules/h3').defineWebSocket
  const defineWebSocketHandler: typeof import('../../node_modules/h3').defineWebSocketHandler
  const deleteByFile: typeof import('../../server/utils/vector-db').deleteByFile
  const deleteCookie: typeof import('../../node_modules/h3').deleteCookie
  const deleteTask: typeof import('../../server/utils/db').deleteTask
  const detectCalendarIntent: typeof import('../../server/utils/intent-detector').detectCalendarIntent
  const detectEmailIntent: typeof import('../../server/utils/intent-detector').detectEmailIntent
  const detectIntent: typeof import('../../server/utils/intent-detector').detectIntent
  const detectPatterns: typeof import('../../server/utils/user-profile').detectPatterns
  const detectTaskIntent: typeof import('../../server/utils/intent-detector').detectTaskIntent
  const downloadTelegramFile: typeof import('../../server/utils/telegram').downloadTelegramFile
  const dynamicEventHandler: typeof import('../../node_modules/h3').dynamicEventHandler
  const embedBatch: typeof import('../../server/utils/embeddings').embedBatch
  const embedPendingMemories: typeof import('../../server/utils/memory-store').embedPendingMemories
  const embedText: typeof import('../../server/utils/embeddings').embedText
  const enqueueMessage: typeof import('../../server/utils/db').enqueueMessage
  const estimateTokens: typeof import('../../server/utils/context-compressor').estimateTokens
  const eventHandler: typeof import('../../node_modules/h3').eventHandler
  const executeAgentLoop: typeof import('../../server/utils/agent').executeAgentLoop
  const fetchWithEvent: typeof import('../../node_modules/h3').fetchWithEvent
  const filterMessages: typeof import('../../server/utils/notification-filter').filterMessages
  const formatAlarmConfirmation: typeof import('../../server/utils/tasker-alarms').formatAlarmConfirmation
  const formatEmailForConfirmation: typeof import('../../server/utils/gmail-api').formatEmailForConfirmation
  const formatResultsForContext: typeof import('../../server/utils/semantic-search').formatResultsForContext
  const fromNodeMiddleware: typeof import('../../node_modules/h3').fromNodeMiddleware
  const fromPlainHandler: typeof import('../../node_modules/h3').fromPlainHandler
  const fromWebHandler: typeof import('../../node_modules/h3').fromWebHandler
  const generateCatchupBriefing: typeof import('../../server/utils/briefings').generateCatchupBriefing
  const generateEmailPrompt: typeof import('../../server/utils/intent-detector').generateEmailPrompt
  const generateEveningSummary: typeof import('../../server/utils/briefings').generateEveningSummary
  const generateMorningBriefing: typeof import('../../server/utils/briefings').generateMorningBriefing
  const generateNyxDigest: typeof import('../../server/utils/ai').generateNyxDigest
  const getAgentLogs: typeof import('../../server/utils/db').getAgentLogs
  const getAllTasks: typeof import('../../server/utils/db').getAllTasks
  const getCategoryCounts: typeof import('../../server/utils/db').getCategoryCounts
  const getChunkCount: typeof import('../../server/utils/vector-db').getChunkCount
  const getConversationStats: typeof import('../../server/utils/db').getConversationStats
  const getConversationsSince: typeof import('../../server/utils/db').getConversationsSince
  const getCookie: typeof import('../../node_modules/h3').getCookie
  const getDbSize: typeof import('../../server/utils/vector-db').getDbSize
  const getEmbeddingDimensions: typeof import('../../server/utils/embeddings').getEmbeddingDimensions
  const getEmbeddingModel: typeof import('../../server/utils/embeddings').getEmbeddingModel
  const getFileCount: typeof import('../../server/utils/vector-db').getFileCount
  const getGeminiVersion: typeof import('../../server/utils/gemini-cli').getGeminiVersion
  const getHeader: typeof import('../../node_modules/h3').getHeader
  const getHeaders: typeof import('../../node_modules/h3').getHeaders
  const getImportantMemories: typeof import('../../server/utils/memory-store').getImportantMemories
  const getIndexedFileMtime: typeof import('../../server/utils/vector-db').getIndexedFileMtime
  const getLatestPendingAction: typeof import('../../server/utils/conversation-state').getLatestPendingAction
  const getMemoryCount: typeof import('../../server/utils/memory-store').getMemoryCount
  const getMemoryStats: typeof import('../../server/utils/memory-store').getMemoryStats
  const getMeta: typeof import('../../server/utils/vector-db').getMeta
  const getMethod: typeof import('../../node_modules/h3').getMethod
  const getOverdueTasks: typeof import('../../server/utils/db').getOverdueTasks
  const getPendingAction: typeof import('../../server/utils/conversation-state').getPendingAction
  const getPendingMessages: typeof import('../../server/utils/db').getPendingMessages
  const getPendingMessagesByCategory: typeof import('../../server/utils/db').getPendingMessagesByCategory
  const getProxyRequestHeaders: typeof import('../../node_modules/h3').getProxyRequestHeaders
  const getQuery: typeof import('../../node_modules/h3').getQuery
  const getQueueStats: typeof import('../../server/utils/gemini-tmux').getQueueStats
  const getRecentConversations: typeof import('../../server/utils/db').getRecentConversations
  const getRecentMemories: typeof import('../../server/utils/memory-store').getRecentMemories
  const getRecentOutput: typeof import('../../server/utils/gemini-tmux').getRecentOutput
  const getRelevantFacts: typeof import('../../server/utils/user-profile').getRelevantFacts
  const getRequestFingerprint: typeof import('../../node_modules/h3').getRequestFingerprint
  const getRequestHeader: typeof import('../../node_modules/h3').getRequestHeader
  const getRequestHeaders: typeof import('../../node_modules/h3').getRequestHeaders
  const getRequestHost: typeof import('../../node_modules/h3').getRequestHost
  const getRequestIP: typeof import('../../node_modules/h3').getRequestIP
  const getRequestPath: typeof import('../../node_modules/h3').getRequestPath
  const getRequestProtocol: typeof import('../../node_modules/h3').getRequestProtocol
  const getRequestURL: typeof import('../../node_modules/h3').getRequestURL
  const getRequestWebStream: typeof import('../../node_modules/h3').getRequestWebStream
  const getResponseHeader: typeof import('../../node_modules/h3').getResponseHeader
  const getResponseHeaders: typeof import('../../node_modules/h3').getResponseHeaders
  const getResponseStatus: typeof import('../../node_modules/h3').getResponseStatus
  const getResponseStatusText: typeof import('../../node_modules/h3').getResponseStatusText
  const getRouteRules: typeof import('../../node_modules/nitropack/dist/runtime/internal/route-rules').getRouteRules
  const getRouterParam: typeof import('../../node_modules/h3').getRouterParam
  const getRouterParams: typeof import('../../node_modules/h3').getRouterParams
  const getSession: typeof import('../../node_modules/h3').getSession
  const getSheetData: typeof import('../../server/utils/sheets').getSheetData
  const getTaskById: typeof import('../../server/utils/db').getTaskById
  const getTasksDueSoon: typeof import('../../server/utils/db').getTasksDueSoon
  const getTasksDueToday: typeof import('../../server/utils/db').getTasksDueToday
  const getTelegramFile: typeof import('../../server/utils/telegram').getTelegramFile
  const getTmuxSessionName: typeof import('../../server/utils/gemini-tmux').getTmuxSessionName
  const getTodayDuty: typeof import('../../server/utils/duty').getTodayDuty
  const getUserLocation: typeof import('../../server/utils/db').getUserLocation
  const getUserPendingActions: typeof import('../../server/utils/conversation-state').getUserPendingActions
  const getUserProfile: typeof import('../../server/utils/user-profile').getUserProfile
  const getValidatedQuery: typeof import('../../node_modules/h3').getValidatedQuery
  const getValidatedRouterParams: typeof import('../../node_modules/h3').getValidatedRouterParams
  const getVectorDb: typeof import('../../server/utils/vector-db').getVectorDb
  const handleCacheHeaders: typeof import('../../node_modules/h3').handleCacheHeaders
  const handleCors: typeof import('../../node_modules/h3').handleCors
  const importExistingConversations: typeof import('../../server/utils/memory-store').importExistingConversations
  const indexSpecificFiles: typeof import('../../server/utils/index-files').indexSpecificFiles
  const indexVaultFiles: typeof import('../../server/utils/vault-indexer').indexVaultFiles
  const isCorsOriginAllowed: typeof import('../../node_modules/h3').isCorsOriginAllowed
  const isError: typeof import('../../node_modules/h3').isError
  const isEvent: typeof import('../../node_modules/h3').isEvent
  const isEventHandler: typeof import('../../node_modules/h3').isEventHandler
  const isMethod: typeof import('../../node_modules/h3').isMethod
  const isPreflightRequest: typeof import('../../node_modules/h3').isPreflightRequest
  const isStream: typeof import('../../node_modules/h3').isStream
  const isUserOnDuty: typeof import('../../server/utils/duty').isUserOnDuty
  const isValidEmail: typeof import('../../server/utils/gmail-api').isValidEmail
  const isWebResponse: typeof import('../../node_modules/h3').isWebResponse
  const lazyEventHandler: typeof import('../../node_modules/h3').lazyEventHandler
  const learnFromInteraction: typeof import('../../server/utils/user-profile').learnFromInteraction
  const locationName: typeof import('../../server/utils/db').locationName
  const logAgentAction: typeof import('../../server/utils/db').logAgentAction
  const markMessagesAsSent: typeof import('../../server/utils/db').markMessagesAsSent
  const nitroPlugin: typeof import('../../node_modules/nitropack/dist/runtime/internal/plugin').nitroPlugin
  const normalizeEmail: typeof import('../../server/utils/gmail-api').normalizeEmail
  const parseAIEmailResponse: typeof import('../../server/utils/gmail-api').parseAIEmailResponse
  const parseAlarmRequest: typeof import('../../server/utils/tasker-alarms').parseAlarmRequest
  const parseApolloDuty: typeof import('../../server/utils/duty').parseApolloDuty
  const parseCookies: typeof import('../../node_modules/h3').parseCookies
  const promisifyNodeListener: typeof import('../../node_modules/h3').promisifyNodeListener
  const proxyRequest: typeof import('../../node_modules/h3').proxyRequest
  const pruneGeminiSessions: typeof import('../../server/utils/db').pruneGeminiSessions
  const pullVaultChanges: typeof import('../../server/utils/git').pullVaultChanges
  const purgeOldQueueMessages: typeof import('../../server/utils/db').purgeOldQueueMessages
  const readBody: typeof import('../../node_modules/h3').readBody
  const readFormData: typeof import('../../node_modules/h3').readFormData
  const readJson: typeof import('../../server/utils/db').readJson
  const readMultipartFormData: typeof import('../../node_modules/h3').readMultipartFormData
  const readRawBody: typeof import('../../node_modules/h3').readRawBody
  const readValidatedBody: typeof import('../../node_modules/h3').readValidatedBody
  const removeResponseHeader: typeof import('../../node_modules/h3').removeResponseHeader
  const runAgent: typeof import('../../server/utils/agent-runner').runAgent
  const runNyxAnalysis: typeof import('../../server/utils/ai').runNyxAnalysis
  const runNyxChat: typeof import('../../server/utils/ai').runNyxChat
  const runNyxLocationBriefing: typeof import('../../server/utils/ai').runNyxLocationBriefing
  const runSmartCleanup: typeof import('../../server/utils/db').runSmartCleanup
  const runTask: typeof import('../../node_modules/nitropack/dist/runtime/internal/task').runTask
  const sanitizeStatusCode: typeof import('../../node_modules/h3').sanitizeStatusCode
  const sanitizeStatusMessage: typeof import('../../node_modules/h3').sanitizeStatusMessage
  const saveConversationMessage: typeof import('../../server/utils/db').saveConversationMessage
  const saveMemory: typeof import('../../server/utils/memory-store').saveMemory
  const saveUserProfile: typeof import('../../server/utils/user-profile').saveUserProfile
  const sealSession: typeof import('../../node_modules/h3').sealSession
  const searchMemoryFTS: typeof import('../../server/utils/memory-store').searchMemoryFTS
  const searchMemoryVector: typeof import('../../server/utils/memory-store').searchMemoryVector
  const searchVectors: typeof import('../../server/utils/vector-db').searchVectors
  const semanticSearch: typeof import('../../server/utils/semantic-search').semanticSearch
  const send: typeof import('../../node_modules/h3').send
  const sendAlarmToTasker: typeof import('../../server/utils/tasker-alarms').sendAlarmToTasker
  const sendEmailViaN8n: typeof import('../../server/utils/gmail-api').sendEmailViaN8n
  const sendError: typeof import('../../node_modules/h3').sendError
  const sendIterable: typeof import('../../node_modules/h3').sendIterable
  const sendNoContent: typeof import('../../node_modules/h3').sendNoContent
  const sendProxy: typeof import('../../node_modules/h3').sendProxy
  const sendRedirect: typeof import('../../node_modules/h3').sendRedirect
  const sendStream: typeof import('../../node_modules/h3').sendStream
  const sendTelegramMessage: typeof import('../../server/utils/telegram').sendTelegramMessage
  const sendTelegramPhoto: typeof import('../../server/utils/telegram').sendTelegramPhoto
  const sendToGemini: typeof import('../../server/utils/gemini-cli').sendToGemini
  const sendToGeminiTmux: typeof import('../../server/utils/gemini-tmux').sendToGeminiTmux
  const sendWebResponse: typeof import('../../node_modules/h3').sendWebResponse
  const serveStatic: typeof import('../../node_modules/h3').serveStatic
  const setCookie: typeof import('../../node_modules/h3').setCookie
  const setHeader: typeof import('../../node_modules/h3').setHeader
  const setHeaders: typeof import('../../node_modules/h3').setHeaders
  const setMeta: typeof import('../../server/utils/vector-db').setMeta
  const setResponseHeader: typeof import('../../node_modules/h3').setResponseHeader
  const setResponseHeaders: typeof import('../../node_modules/h3').setResponseHeaders
  const setResponseStatus: typeof import('../../node_modules/h3').setResponseStatus
  const shouldSendNotification: typeof import('../../server/utils/notification-filter').shouldSendNotification
  const splitCookiesString: typeof import('../../node_modules/h3').splitCookiesString
  const suggestButtons: typeof import('../../server/utils/buttons').suggestButtons
  const toEventHandler: typeof import('../../node_modules/h3').toEventHandler
  const toNodeListener: typeof import('../../node_modules/h3').toNodeListener
  const toPlainHandler: typeof import('../../node_modules/h3').toPlainHandler
  const toWebHandler: typeof import('../../node_modules/h3').toWebHandler
  const toWebRequest: typeof import('../../node_modules/h3').toWebRequest
  const transcribeVoice: typeof import('../../server/utils/voice').transcribeVoice
  const trimConversations: typeof import('../../server/utils/db').trimConversations
  const unsealSession: typeof import('../../node_modules/h3').unsealSession
  const updateHotMemory: typeof import('../../server/utils/user-profile').updateHotMemory
  const updatePreference: typeof import('../../server/utils/user-profile').updatePreference
  const updateSession: typeof import('../../node_modules/h3').updateSession
  const updateSheetData: typeof import('../../server/utils/sheets').updateSheetData
  const updateTask: typeof import('../../server/utils/db').updateTask
  const updateUserLocation: typeof import('../../server/utils/db').updateUserLocation
  const updates: typeof import('../../server/utils/db').updates
  const upsertChunk: typeof import('../../server/utils/vector-db').upsertChunk
  const useAppConfig: typeof import('../../node_modules/nitropack/dist/runtime/internal/config').useAppConfig
  const useBase: typeof import('../../node_modules/h3').useBase
  const useEvent: typeof import('../../node_modules/nitropack/dist/runtime/internal/context').useEvent
  const useNitroApp: typeof import('../../node_modules/nitropack/dist/runtime/internal/app').useNitroApp
  const useRuntimeConfig: typeof import('../../node_modules/nitropack/dist/runtime/internal/config').useRuntimeConfig
  const useSession: typeof import('../../node_modules/h3').useSession
  const useStorage: typeof import('../../node_modules/nitropack/dist/runtime/internal/storage').useStorage
  const writeEarlyHints: typeof import('../../node_modules/h3').writeEarlyHints
}
// for type re-export
declare global {
  // @ts-ignore
  export type { EventHandler, EventHandlerRequest, EventHandlerResponse, EventHandlerObject, H3EventContext } from '../../node_modules/h3'
  import('../../node_modules/h3')
  // @ts-ignore
  export type { AgentResponse } from '../../server/utils/agent-runner'
  import('../../server/utils/agent-runner')
  // @ts-ignore
  export type { NYXConfig } from '../../server/utils/agent'
  import('../../server/utils/agent')
  // @ts-ignore
  export type { BrowseOptions, BrowseResult } from '../../server/utils/browser-agent'
  import('../../server/utils/browser-agent')
  // @ts-ignore
  export type { PendingAction } from '../../server/utils/conversation-state'
  import('../../server/utils/conversation-state')
  // @ts-ignore
  export type { NyxState, LearnedFact, UserProfile, AgentLog, NyxMessage, ConversationMessage, NyxTask } from '../../server/utils/db'
  import('../../server/utils/db')
  // @ts-ignore
  export type { DutyType, DutyShift } from '../../server/utils/duty'
  import('../../server/utils/duty')
  // @ts-ignore
  export type { EmailDraft, SentEmail } from '../../server/utils/gmail-api'
  import('../../server/utils/gmail-api')
  // @ts-ignore
  export type { Intent } from '../../server/utils/intent-detector'
  import('../../server/utils/intent-detector')
  // @ts-ignore
  export type { MemoryEntry, MemorySearchResult } from '../../server/utils/memory-store'
  import('../../server/utils/memory-store')
  // @ts-ignore
  export type { FilterResult } from '../../server/utils/notification-filter'
  import('../../server/utils/notification-filter')
  // @ts-ignore
  export type { SemanticSearchResult } from '../../server/utils/semantic-search'
  import('../../server/utils/semantic-search')
  // @ts-ignore
  export type { AlarmRequest, AlarmResponse } from '../../server/utils/tasker-alarms'
  import('../../server/utils/tasker-alarms')
  // @ts-ignore
  export type { TelegramButton, SendMessageOptions } from '../../server/utils/telegram'
  import('../../server/utils/telegram')
  // @ts-ignore
  export type { DetectedPattern } from '../../server/utils/user-profile'
  import('../../server/utils/user-profile')
  // @ts-ignore
  export type { IndexOptions, IndexResult } from '../../server/utils/vault-indexer'
  import('../../server/utils/vault-indexer')
  // @ts-ignore
  export type { VectorChunk, SearchResult } from '../../server/utils/vector-db'
  import('../../server/utils/vector-db')
}
export { H3Event, H3Error, appendCorsHeaders, appendCorsPreflightHeaders, appendHeader, appendHeaders, appendResponseHeader, appendResponseHeaders, assertMethod, callNodeListener, clearResponseHeaders, clearSession, createApp, createAppEventHandler, createError, createEvent, createEventStream, createRouter, defaultContentType, defineEventHandler, defineLazyEventHandler, defineNodeListener, defineNodeMiddleware, defineRequestMiddleware, defineResponseMiddleware, defineWebSocket, defineWebSocketHandler, deleteCookie, dynamicEventHandler, eventHandler, fetchWithEvent, fromNodeMiddleware, fromPlainHandler, fromWebHandler, getCookie, getHeader, getHeaders, getMethod, getProxyRequestHeaders, getQuery, getRequestFingerprint, getRequestHeader, getRequestHeaders, getRequestHost, getRequestIP, getRequestPath, getRequestProtocol, getRequestURL, getRequestWebStream, getResponseHeader, getResponseHeaders, getResponseStatus, getResponseStatusText, getRouterParam, getRouterParams, getSession, getValidatedQuery, getValidatedRouterParams, handleCacheHeaders, handleCors, isCorsOriginAllowed, isError, isEvent, isEventHandler, isMethod, isPreflightRequest, isStream, isWebResponse, lazyEventHandler, parseCookies, promisifyNodeListener, proxyRequest, readBody, readFormData, readMultipartFormData, readRawBody, readValidatedBody, removeResponseHeader, sanitizeStatusCode, sanitizeStatusMessage, sealSession, send, sendError, sendIterable, sendNoContent, sendProxy, sendRedirect, sendStream, sendWebResponse, serveStatic, setCookie, setHeader, setHeaders, setResponseHeader, setResponseHeaders, setResponseStatus, splitCookiesString, toEventHandler, toNodeListener, toPlainHandler, toWebHandler, toWebRequest, unsealSession, updateSession, useBase, useSession, writeEarlyHints } from 'h3';
export { useNitroApp } from 'nitropack/runtime/internal/app';
export { useRuntimeConfig, useAppConfig } from 'nitropack/runtime/internal/config';
export { defineNitroPlugin, nitroPlugin } from 'nitropack/runtime/internal/plugin';
export { defineCachedFunction, defineCachedEventHandler, cachedFunction, cachedEventHandler } from 'nitropack/runtime/internal/cache';
export { useStorage } from 'nitropack/runtime/internal/storage';
export { defineRenderHandler } from 'nitropack/runtime/internal/renderer';
export { defineRouteMeta } from 'nitropack/runtime/internal/meta';
export { getRouteRules } from 'nitropack/runtime/internal/route-rules';
export { useEvent } from 'nitropack/runtime/internal/context';
export { defineTask, runTask } from 'nitropack/runtime/internal/task';
export { defineNitroErrorHandler } from 'nitropack/runtime/internal/error/utils';
export { buildAssetsURL as __buildAssetsURL, publicAssetsURL as __publicAssetsURL } from '/home/ubuntu/pantheon-new/node_modules/@nuxt/nitro-server/dist/runtime/utils/paths';
export { defineAppConfig } from '/home/ubuntu/pantheon-new/node_modules/@nuxt/nitro-server/dist/runtime/utils/config';
export { runAgent } from '/home/ubuntu/pantheon-new/server/utils/agent-runner';
export { executeAgentLoop } from '/home/ubuntu/pantheon-new/server/utils/agent';
export { generateNyxDigest, runNyxAnalysis, runNyxChat, runNyxLocationBriefing } from '/home/ubuntu/pantheon-new/server/utils/ai';
export { checkSpendingVelocity } from '/home/ubuntu/pantheon-new/server/utils/analytics';
export { generateMorningBriefing, generateCatchupBriefing, generateEveningSummary } from '/home/ubuntu/pantheon-new/server/utils/briefings';
export { browse } from '/home/ubuntu/pantheon-new/server/utils/browser-agent';
export { suggestButtons } from '/home/ubuntu/pantheon-new/server/utils/buttons';
export { buildSmartContext, estimateTokens, calculateTokenSavings, compressOldContext } from '/home/ubuntu/pantheon-new/server/utils/context-compressor';
export { createEmailConfirmation, getPendingAction, getLatestPendingAction, completePendingAction, cancelUserActions, cleanupExpiredActions, getUserPendingActions } from '/home/ubuntu/pantheon-new/server/utils/conversation-state';
export { readJson, updateUserLocation, locationName, getUserLocation, logAgentAction, getAgentLogs, enqueueMessage, getPendingMessages, getPendingMessagesByCategory, getCategoryCounts, markMessagesAsSent, saveConversationMessage, getRecentConversations, getConversationsSince, createTask, updateTask, updates, getTaskById, getAllTasks, getTasksDueToday, getTasksDueSoon, getOverdueTasks, deleteTask, getConversationStats, purgeOldQueueMessages, trimConversations, cleanTempFiles, pruneGeminiSessions, runSmartCleanup } from '/home/ubuntu/pantheon-new/server/utils/db';
export { parseApolloDuty, getTodayDuty, isUserOnDuty } from '/home/ubuntu/pantheon-new/server/utils/duty';
export { embedText, embedBatch, getEmbeddingDimensions, getEmbeddingModel } from '/home/ubuntu/pantheon-new/server/utils/embeddings';
export { callGeminiAPI } from '/home/ubuntu/pantheon-new/server/utils/gemini-api';
export { sendToGemini, checkGeminiHealth, getGeminiVersion } from '/home/ubuntu/pantheon-new/server/utils/gemini-cli';
export { getQueueStats, sendToGeminiTmux, getTmuxSessionName, attachToSession, getRecentOutput, checkTmuxHealth } from '/home/ubuntu/pantheon-new/server/utils/gemini-tmux';
export { pullVaultChanges } from '/home/ubuntu/pantheon-new/server/utils/git';
export { sendEmailViaN8n, formatEmailForConfirmation, parseAIEmailResponse, isValidEmail, normalizeEmail } from '/home/ubuntu/pantheon-new/server/utils/gmail-api';
export { callGroqAPI } from '/home/ubuntu/pantheon-new/server/utils/groq-api';
export { indexSpecificFiles } from '/home/ubuntu/pantheon-new/server/utils/index-files';
export { detectEmailIntent, detectCalendarIntent, detectTaskIntent, detectIntent, generateEmailPrompt } from '/home/ubuntu/pantheon-new/server/utils/intent-detector';
export { saveMemory, embedPendingMemories, searchMemoryFTS, searchMemoryVector, getRecentMemories, getImportantMemories, getMemoryCount, getMemoryStats, buildMemoryContext, importExistingConversations } from '/home/ubuntu/pantheon-new/server/utils/memory-store';
export { shouldSendNotification, filterMessages, applyPriorityBoost } from '/home/ubuntu/pantheon-new/server/utils/notification-filter';
export { semanticSearch, formatResultsForContext } from '/home/ubuntu/pantheon-new/server/utils/semantic-search';
export { getSheetData, updateSheetData } from '/home/ubuntu/pantheon-new/server/utils/sheets';
export { parseAlarmRequest, sendAlarmToTasker, formatAlarmConfirmation } from '/home/ubuntu/pantheon-new/server/utils/tasker-alarms';
export { sendTelegramMessage, getTelegramFile, downloadTelegramFile, sendTelegramPhoto } from '/home/ubuntu/pantheon-new/server/utils/telegram';
export { getUserProfile, saveUserProfile, updateHotMemory, addLearnedFact, updatePreference, detectPatterns, learnFromInteraction, getRelevantFacts } from '/home/ubuntu/pantheon-new/server/utils/user-profile';
export { indexVaultFiles } from '/home/ubuntu/pantheon-new/server/utils/vault-indexer';
export { getVectorDb, upsertChunk, deleteByFile, searchVectors, getChunkCount, getFileCount, getIndexedFileMtime, getMeta, setMeta, getDbSize, closeVectorDb } from '/home/ubuntu/pantheon-new/server/utils/vector-db';
export { transcribeVoice } from '/home/ubuntu/pantheon-new/server/utils/voice';