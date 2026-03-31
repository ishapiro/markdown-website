<template>
  <div
    ref="editorRoot"
    class="h-full overflow-auto bg-vault-bg font-mono text-vault-text outline-none"
    :style="{ fontSize: fontSize }"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'

const props = withDefaults(
  defineProps<{
    modelValue: string
    externalCursorPos?: number
    fontSize?: string
    lineWrap?: boolean
  }>(),
  { fontSize: '0.875rem', lineWrap: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'selectionChange', payload: { text: string } | null): void
  (e: 'selectionMeta', payload: { from: number; to: number; empty: boolean }): void
}>()

const editorRoot = ref<HTMLElement | null>(null)
let view: EditorView | null = null
let lineWrapCompartment: Compartment | null = null
let isUpdatingFromView = false

onMounted(() => {
  if (!editorRoot.value) return

  lineWrapCompartment = new Compartment()

  const state = EditorState.create({
    doc: props.modelValue || '',
    extensions: [
      drawSelection(),
      lineWrapCompartment.of(props.lineWrap ? [EditorView.lineWrapping] : []),
      EditorView.editorAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'off' }),
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      keymap.of(defaultKeymap),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isUpdatingFromView = true
          emit('update:modelValue', update.state.doc.toString())
          isUpdatingFromView = false
        }
        if (update.selectionSet) {
          const sel = update.state.selection.main
          emit('selectionMeta', { from: sel.from, to: sel.to, empty: sel.empty })
          if (!sel.empty) {
            emit('selectionChange', { text: update.state.doc.sliceString(sel.from, sel.to) })
          } else {
            emit('selectionChange', null)
          }
        }
      }),
      EditorView.theme({
        '&.cm-editor': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: 'inherit',
          outline: 'none',
          backgroundColor: 'transparent',
          height: '100%',
        },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '0.75rem 1rem', color: '#222222', minHeight: '100%' },
        '.cm-line': { lineHeight: '1.6' },
        '.cm-selectionBackground': { backgroundColor: 'rgba(120, 82, 238, 0.18)' },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(120, 82, 238, 0.25)' },
        '.cm-cursor': { borderLeftColor: '#7852ee' },
        '.cm-gutters': { display: 'none' },
      }),
    ],
  })

  view = new EditorView({ state, parent: editorRoot.value })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view || isUpdatingFromView) return
    const current = view.state.doc.toString()
    if ((value || '') !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
        effects: lineWrapCompartment?.reconfigure(props.lineWrap ? [EditorView.lineWrapping] : []),
      })
    }
  },
)

watch(
  () => props.externalCursorPos,
  (pos) => {
    if (!view || typeof pos !== 'number') return
    const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
    view.focus()
    view.dispatch({ selection: { anchor: clamped }, scrollIntoView: true })
  },
)

watch(
  () => props.lineWrap,
  (wrap) => {
    if (view && lineWrapCompartment) {
      view.dispatch({ effects: lineWrapCompartment.reconfigure(wrap ? [EditorView.lineWrapping] : []) })
    }
  },
)
</script>
