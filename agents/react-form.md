# React Form ガイドライン

フォームを実装するとき(React Hook Form を導入する場合)に参照する。

- 各フィールドは `register` を直接バインドする(`watch` + `setValue` による手動ハンドリングを禁じる)
- 初期値は `useState` 等で持たず `defaultValue` を使う
- checkbox の配列は `string[]` として扱う
- フォーム全体のリセットは `reset()` の手動呼び出しではなく、`key` を更新してコンポーネントごと再マウントする方式を優先する
