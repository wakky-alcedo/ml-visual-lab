# Colab ノートブック配置手順と Open in Colab バッジ

## 1. GitHub リポジトリへの配置

### 前提
- このプロジェクトの GitHub リポジトリが `https://github.com/<user>/<repo>` に存在すること
- `notebooks/` ディレクトリを `main` ブランチの直下に置くこと

### 手順

```bash
# 1. ノートブックを notebooks/ ディレクトリごと git に追加
git add notebooks/01_logic_minmax.ipynb
git add notebooks/02_cifar100_basics.ipynb
git add notebooks/03_cifar100_improve.ipynb
git add notebooks/04_transfer_multiclass.ipynb

# 2. コミット
git commit -m "Add Colab notebooks for M2/M4/M5/M6"

# 3. main ブランチにプッシュ
git push origin main
```

プッシュ後、GitHub 上で `notebooks/xx.ipynb` が確認できれば配置完了です。

---

## 2. Open in Colab バッジ URL

`<user>` と `<repo>` を実際の GitHub ユーザー名・リポジトリ名に置き換えてください。

### バッジ URL 一覧

| ノートブック | Colab URL |
|---|---|
| 01_logic_minmax.ipynb | `https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/01_logic_minmax.ipynb` |
| 02_cifar100_basics.ipynb | `https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/02_cifar100_basics.ipynb` |
| 03_cifar100_improve.ipynb | `https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/03_cifar100_improve.ipynb` |
| 04_transfer_multiclass.ipynb | `https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/04_transfer_multiclass.ipynb` |

### Markdown バッジ埋め込みコード

MDX ページや README に貼り付けるバッジ形式です。

```markdown
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/01_logic_minmax.ipynb)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/02_cifar100_basics.ipynb)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/03_cifar100_improve.ipynb)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/04_transfer_multiclass.ipynb)
```

### Astro MDX での使用例

サイトの各モジュールページ（例: `src/content/modules/m2.mdx`）に以下を追加してください。

```mdx
import ColabBadge from '@/components/ColabBadge.astro'

<ColabBadge
  href="https://colab.research.google.com/github/<user>/<repo>/blob/main/notebooks/01_logic_minmax.ipynb"
  label="M2 練習ノートブック（論理演算・min/max）を Colab で開く"
/>
```

`ColabBadge.astro` コンポーネントの実装例:

```astro
---
interface Props {
  href: string;
  label?: string;
}
const { href, label = "Open in Colab" } = Astro.props;
---
<a href={href} target="_blank" rel="noopener noreferrer">
  <img
    src="https://colab.research.google.com/assets/colab-badge.svg"
    alt={label}
    title={label}
  />
</a>
```

---

## 3. ノートブックと学習サイトモジュールの対応

| ファイル | 対応モジュール | 用途 |
|---|---|---|
| `01_logic_minmax.ipynb` | M2 | ニューロンで論理演算・min/max（授業課題1） |
| `02_cifar100_basics.ipynb` | M4 | CIFAR-100 ベースライン CNN（授業課題2 基礎） |
| `03_cifar100_improve.ipynb` | M4/M5 | Dropout/BN/DA 改善実験（授業課題2 精度向上） |
| `04_transfer_multiclass.ipynb` | M6 | 転移学習で自前データ分類（授業課題3・最終レポート） |

---

## 4. ノートブック検証コマンド

JSON として正当かどうかをローカルで確認するコマンドです。

```bash
for f in notebooks/*.ipynb; do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done
```

---

## 5. 注意事項

- GitHub のリポジトリが **Public** であること（Private リポジトリは Colab から直接開けない）
- ブランチ名が `main` でない場合（例: `master`）は URL の `main` 部分を変更すること
- Colab で開いた後は「ドライブにコピー」を促す案内をノートブック冒頭に記載済みです
- GPU が必要なノートブック（02, 03）は冒頭セルにランタイム変更の案内を記載済みです
