import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { keyboardOverlap, screenEdges } from '../src/ui/presentation'

function source(path: string) {
  return ts.createSourceFile(path, readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}
function attributes(file: ts.SourceFile, component: string) {
  const found: ts.JsxAttributes[] = []
  function visit(node: ts.Node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === component) found.push(node.attributes)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
function attribute(props: ts.JsxAttributes, name: string) {
  return props.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText() === name)
}

test('root retains Protected and chooses login as its anchor; private layout never dispatches its own redirect', () => {
  const root = source('app/_layout.tsx'), privateLayout = source('app/(private)/_layout.tsx')
  assert.match(root.text, /initialRouteName: 'login'/)
  const guard = attributes(root, 'Stack.Protected')[0]
  assert.ok(guard)
  assert.equal(attribute(guard, 'guard')?.initializer?.getText(root), '{canAccessPrivate(session)}')
  assert.match(root.text, /name="\(private\)"/)
  assert.equal(attributes(privateLayout, 'Redirect').length, 0)
  assert.match(privateLayout.text, /if \(!canAccessPrivate\(session\)\) return null/)
  assert.doesNotMatch(source('screens/ProfileScreen.tsx').text, /router\.(?:replace|push)\(['"]\/login/)
})

test('login has a single submit button in the Screen footer, not inside the scrollable form', () => {
  const login = source('screens/LoginScreen.tsx')
  const screen = attributes(login, 'Screen')[0]
  assert.ok(screen)
  const footer = attribute(screen, 'footer')?.initializer
  assert.ok(footer && ts.isJsxExpression(footer) && footer.expression && ts.isJsxSelfClosingElement(footer.expression))
  assert.equal(footer.expression.tagName.getText(login), 'ActionButton')
  const submit = attribute(footer.expression.attributes, 'label')?.initializer
  assert.ok(submit && ts.isStringLiteral(submit))
  assert.equal(submit.text, 'Iniciar sesión')
  assert.equal(attributes(login, 'ActionButton').filter((props) =>
    attribute(props, 'label')?.initializer?.getText(login) === '"Iniciar sesión"').length, 1)
  for (const props of attributes(login, 'FormField')) assert.ok(attribute(props, 'error'))
})

test('footer consumes IME overlap once while content remains scrollable and measured footer height protects input focus', () => {
  const screen = source('components/Screen.tsx')
  const list = attributes(screen, 'ScrollableContent').find((props) => attribute(props, 'revealOffset'))
  assert.ok(list)
  assert.equal(attribute(list, 'inset')?.initializer?.getText(screen), '{0}')
  assert.equal(attribute(list, 'revealOffset')?.initializer?.getText(screen), '{footerHeight}')
  assert.match(screen.text, /paddingBottom: inset/)
  assert.match(screen.text, /nativeEvent\.layout\.height/)
  assert.match(screen.text, /theme\.spacing\.lg \+ revealOffset/)
  assert.doesNotMatch(screen.text, /KeyboardAvoidingView/)
  assert.ok(attributes(screen, 'ScrollView').length > 0)
})

test('small-screen keyboard geometries do not double-count adjustResize or safe area', () => {
  // Coordinates measured on a 360dp-wide layout; width does not change the IME
  // formula. Android rendering and TalkBack remain physical-device checks.
  assert.equal(keyboardOverlap(24, 616, null), 0)
  assert.equal(keyboardOverlap(24, 336, 360), 0)
  assert.equal(keyboardOverlap(24, 616, 360), 280)
  assert.equal(keyboardOverlap(24, 200, 360), 0)
  assert.deepEqual(screenEdges('none', false, true), ['top', 'left', 'right'])
  assert.deepEqual(screenEdges('none', false, false), ['top', 'left', 'right', 'bottom'])
})

test('font growth uses measured footer height and preserves institutional brand and accessible field labels', () => {
  const login = source('screens/LoginScreen.tsx'), screen = source('components/Screen.tsx')
  assert.equal(attributes(login, 'EidaBrand').length, 1)
  assert.match(login.text, /Correo o código institucional/)
  assert.match(login.text, /Contraseña/)
  assert.match(screen.text, /onLayout=.*setFooterHeight/)
  const footerStyles = screen.text.slice(screen.text.indexOf('footer:'))
  assert.doesNotMatch(footerStyles, /height: \d+/)
})

