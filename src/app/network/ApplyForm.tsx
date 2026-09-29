'use client'

import Link from 'next/link'
import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import styles from './network.module.css'

interface FormValues {
  company: string
  contact: string
  mstAmount: string
  memo: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const EMPTY: FormValues = { company: '', contact: '', mstAmount: '', memo: '' }

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!values.company.trim()) errors.company = '회사명을 입력하세요.'
  if (!values.contact.trim()) errors.contact = '연락처 또는 이메일을 입력하세요.'
  const amount = values.mstAmount.trim()
  if (!amount) errors.mstAmount = '예치할 MST 수량을 입력하세요.'
  else if (!/^\d+$/.test(amount) || Number(amount) < 1) errors.mstAmount = '1 이상의 정수로 입력하세요.'
  return errors
}

/**
 * 네트워크 생성 신청 폼. 기존 사이트와 같이 브라우저 안에서 접수 안내만 보여 준다
 * (신청 정보를 서버로 전송하지 않는다).
 */
export function ApplyForm() {
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submittedCompany, setSubmittedCompany] = useState<string | null>(null)

  const update = (key: keyof FormValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    const firstInvalid = (Object.keys(nextErrors) as Array<keyof FormValues>)[0]
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }
    setSubmittedCompany(values.company.trim())
    setValues(EMPTY)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-describedby="apply-lead">
      <div className={styles.row}>
        <TextField
          label="회사명"
          name="company"
          autoComplete="organization"
          placeholder="예: (주)머스트셈테크"
          maxLength={100}
          value={values.company}
          onChange={(event) => update('company')(event.target.value)}
          error={errors.company}
          required
        />
        <TextField
          label="연락처 / 이메일"
          name="contact"
          autoComplete="email"
          placeholder="예: 010-1234-5678 또는 example@company.com"
          maxLength={120}
          value={values.contact}
          onChange={(event) => update('contact')(event.target.value)}
          error={errors.contact}
          required
        />
      </div>
      <TextField
        label="예치할 MST 수량"
        name="mstAmount"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 1000"
        value={values.mstAmount}
        onChange={(event) => update('mstAmount')(event.target.value.replace(/[^\d]/g, ''))}
        error={errors.mstAmount}
        hint="예치한 MST를 담보로 1:1000 비율의 네이티브 코인이 발행됩니다."
        trailing="MST"
        trailingWidth={40}
        required
      />
      <TextAreaField
        label="기타 요청사항"
        name="memo"
        optional
        rows={4}
        maxLength={1000}
        placeholder="도메인, 네트워크명 등 추가 요청사항을 입력하세요."
        value={values.memo}
        onChange={(event) => update('memo')(event.target.value)}
      />
      <div className={styles.submitRow}>
        <Button type="submit" size="lg" block>
          신청 정보 저장 및 생성 요청
        </Button>
        <p className={styles.privacyNote}>
          입력하신 정보는 네트워크 개설 안내에만 사용됩니다. <Link href="/privacy">개인정보처리방침</Link>
        </p>
      </div>
      {submittedCompany && (
        <Notice tone="success" title="신청이 접수되었습니다" live>
          {submittedCompany} 네트워크는 내부 확인 후 24시간 이내 개설하여 안내드립니다.
        </Notice>
      )}
    </form>
  )
}
