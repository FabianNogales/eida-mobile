import { array, integer, nullableText, object, text } from '../../services/http/schema'
import { protocolError } from '../../services/http/errors'
import type { RequestOptions } from '../../services/http/client'
import { parseDevice } from '../auth/api'

export interface PrivateApi { request(path: string, options?: Omit<RequestOptions, 'token'>): Promise<unknown> }
export type ExamView = 'upcoming' | 'past' | 'cancelled' | 'all'
export interface TeacherExam {
  id: number; name: string; subject_name: string | null; subject_code: string | null
  exam_date: string; start_time: string; duration_minutes: number; status: string
  room: { id: number; code: string; name: string } | null
}
export interface ExamPage { data: TeacherExam[]; currentPage: number; lastPage: number; perPage: number; total: number }
export interface Collaboration {
  exam_id: number; exam_name: string; subject_name: string; exam_date: string
  start_time: string; duration_minutes: number; room: string | null
}
function calendarDate(value: unknown): string {
  const date = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw protocolError()
  return date
}
function clockTime(value: unknown): string {
  const time = text(value)
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) throw protocolError()
  return time
}
function parseExam(value: unknown): TeacherExam {
  const v = object(value), room = v.room === null ? null : object(v.room)
  return { id: integer(v.id), name: text(v.name), subject_name: nullableText(v.subject_name), subject_code: nullableText(v.subject_code),
    exam_date: calendarDate(v.exam_date), start_time: clockTime(v.start_time), duration_minutes: integer(v.duration_minutes), status: text(v.status),
    room: room ? { id: integer(room.id), code: text(room.code), name: text(room.name) } : null }
}
export async function teacherExams(api: PrivateApi, view: ExamView, page: number, signal?: AbortSignal): Promise<ExamPage> {
  const response = object(await api.request('teacher/exams', { query: { view, page, per_page: 10 }, signal }))
  const meta = object(response.meta)
  if (meta.per_page !== 10) throw protocolError()
  return { data: array(response.data, parseExam), currentPage: integer(meta.current_page), lastPage: integer(meta.last_page),
    perPage: 10, total: integer(meta.total, 0) }
}
export async function collaborations(api: PrivateApi, signal?: AbortSignal): Promise<Collaboration[]> {
  const response = object(await api.request('me/collaborations', { signal }))
  return array(response.data, (item) => {
    const v = object(item)
    return { exam_id: integer(v.exam_id), exam_name: text(v.exam_name), subject_name: text(v.subject_name),
      exam_date: calendarDate(v.exam_date), start_time: clockTime(v.start_time), duration_minutes: integer(v.duration_minutes), room: nullableText(v.room) }
  })
}
export async function devices(api: PrivateApi, signal?: AbortSignal) {
  return array(object(await api.request('auth/devices', { signal })).data, parseDevice)
}
export async function revokeDevice(api: PrivateApi, id: number) {
  integer(id)
  await api.request('auth/devices/' + id, { method: 'DELETE', expectedStatus: 204 })
}
