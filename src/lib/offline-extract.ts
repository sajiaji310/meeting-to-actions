import { AppError } from "./errors"
import { postprocess } from "./postprocess"
import type { RawExtraction } from "./schema"
import { isSampleTranscript, QUOTE, SAMPLE_TRANSCRIPT } from "./sample"
import type { ExtractionResult } from "./types"

/**
 * Dates below are resolved from the meeting date written in the sample
 * (2026-03-18, Wednesday), not from the day the demo is opened:
 * 周五下班前 → 2026-03-20, 3 月 25 日 → 2026-03-25,
 * 下周五前 → 2026-03-27, 本月底前 → 2026-03-31.
 * 「尽快」and「会后、今天不锁」stay null.
 */
const GOLD: RawExtraction = {
  meetingTitle: "澄镜客户成功平台 4 月发布准备会",
  meetingDate: "2026-03-18",
  summary:
    "澄镜客户成功平台定于 2026 年 4 月 9 日发布，首发只包含权限与审计、客户健康度、任务中心，报表中心与移动端都不进这次范围。林知夏、陈屿、赵启明、苏晚分别认领了接口冻结、发布物料、标杆客户出席和实施手册。数据处理协议由周衡跟踪但没有日期，北窗提价话术待认领。导出性能被明确移出行动清单。",
  decisions: [
    {
      statement: "4 月 9 日按期发布，不再评估延期。",
      quote: QUOTE.release,
    },
    {
      statement: "首发只包含权限与审计、客户健康度、任务中心。",
      quote: QUOTE.scope,
    },
    {
      statement: "报表中心放入 4 月下旬，移动端本次不排期。",
      quote: QUOTE.defer,
    },
    {
      statement: "发布会对外口径以产品一页纸为准，销售不再单独改数字。",
      quote: QUOTE.voice,
    },
    {
      statement: "大数据量导出不纳入本次行动项。",
      quote: QUOTE.excluded,
    },
  ],
  actionItems: [
    {
      title: "冻结审计日志字段并发送接口文档",
      owner: "林知夏",
      dueDate: "2026-03-20",
      dueTime: null,
      dueDateEvidence: "周五下班前",
      quote: QUOTE.audit,
    },
    {
      title: "交付发布会主视觉和三页产品一页纸",
      owner: "陈屿",
      dueDate: "2026-03-25",
      dueTime: null,
      dueDateEvidence: "下周三，3 月 25 日",
      quote: QUOTE.design,
    },
    {
      title: "收回华东三家标杆客户的出席确认",
      owner: "赵启明",
      dueDate: "2026-03-27",
      dueTime: null,
      dueDateEvidence: "下周五前",
      quote: QUOTE.sales,
    },
    {
      title: "按新范围重写实施手册并标出差异",
      owner: "苏晚",
      dueDate: "2026-03-31",
      dueTime: null,
      dueDateEvidence: "本月底前",
      quote: QUOTE.handbook,
    },
    {
      title: "跟踪数据处理协议补充条款",
      owner: "周衡",
      dueDate: null,
      dueTime: null,
      dueDateEvidence: "尽快，但这次会上给不出日期",
      quote: QUOTE.legal,
    },
    {
      title: "整理北窗提价的一页销售话术",
      owner: null,
      dueDate: null,
      dueTime: null,
      dueDateEvidence: null,
      quote: QUOTE.competitor,
    },
    {
      title: "发出下次同步会日程",
      owner: "许南",
      dueDate: null,
      dueTime: null,
      dueDateEvidence: "会后发出，具体哪天发出今天不锁",
      quote: QUOTE.schedule,
    },
  ],
}

export function extractOffline(transcript: string): ExtractionResult {
  if (!isSampleTranscript(transcript)) {
    throw new AppError(
      "未配置模型 API。离线演示只能提取内置的示例纪要。请载入示例，或配置 OPENAI_API_KEY 后再提取其他文稿。",
      409,
      "LLM_NOT_CONFIGURED",
    )
  }

  return postprocess(transcript, GOLD, { mode: "offline-demo", model: null })
}

export { SAMPLE_TRANSCRIPT }
