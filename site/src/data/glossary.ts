// 用語集のシードデータ（日英対訳）。まずは10語程度。後続バッチが50語程度まで拡充する。
// 用語IDは英語名の kebab-case。TermDef のリンク先 /glossary#<id> と一致させること。
import { toSlug } from "../lib/slug";

export interface GlossaryTerm {
  /** 英語表記。 */
  en: string;
  /** 日本語表記。 */
  ja: string;
  /** 学習者（情報工学ほぼ未習の機械工学専攻）向けの平易な説明。 */
  description: string;
  /** アンカーID（省略時は en から自動生成）。 */
  id?: string;
  /** 関連するモジュール番号（任意）。 */
  modules?: number[];
}

const rawTerms: GlossaryTerm[] = [
  {
    en: "Machine Learning",
    ja: "機械学習",
    description:
      "データから規則性を学び取り、未知の入力に対して予測や分類を行う手法の総称です。人間が規則を書き下す代わりに、例からモデルのパラメータを調整します。",
    modules: [1],
  },
  {
    en: "Deep Learning",
    ja: "深層学習",
    description:
      "多層のニューラルネットワークを用いる機械学習の一分野です。層を深く重ねることで、画像や言語のような複雑なデータの特徴を段階的に捉えます。",
    modules: [1],
  },
  {
    en: "Model",
    ja: "モデル",
    description:
      "入力 x からパラメータ θ を使って出力を計算する関数 y = f(x; θ) のことです。学習とは、このパラメータ θ を良い値に調整する作業を指します。",
    modules: [1],
  },
  {
    en: "Overfitting",
    ja: "過学習",
    description:
      "訓練データに合わせ込みすぎて、新しいデータへの予測が悪くなる状態です。実験ノイズまで再現してしまう過剰な曲線あてはめをイメージすると分かりやすいです。",
    modules: [1, 5],
  },
  {
    en: "Neuron",
    ja: "ニューロン",
    description:
      "入力を重み付けして足し合わせ（wᵀx + b）、活性化関数を通して出力する計算単位です。ニューラルネットワークの最小部品です。",
    modules: [2],
  },
  {
    en: "Activation Function",
    ja: "活性化関数",
    description:
      "ニューロンの線形和に非線形性を加える関数です。シグモイド・tanh・ReLU などがあり、これがないと何層重ねても直線的な変換に留まります。",
    modules: [2, 3],
  },
  {
    en: "Gradient Descent",
    ja: "勾配降下法",
    description:
      "損失を小さくする向き（勾配の逆向き）へパラメータを少しずつ動かす最適化法です。ボールが谷を転がり落ちる様子、学習率はその一歩の幅にたとえられます。",
    modules: [4],
  },
  {
    en: "Backpropagation",
    ja: "誤差逆伝播法",
    description:
      "出力側の誤差を連鎖律で入力側へ順に伝え、各パラメータの勾配を効率よく求める手法です。勾配を層から層へバケツリレーする、と考えると直感的です。",
    modules: [4],
  },
  {
    en: "Convolution",
    ja: "畳み込み",
    description:
      "同じ重み（カーネル）を位置をずらしながら画像全体に適用する線形演算です。重みを使い回すためパラメータ数が少なく、位置によらない特徴を捉えられます。",
    modules: [3],
  },
  {
    en: "Transfer Learning",
    ja: "転移学習",
    description:
      "大規模データで事前学習したモデルの特徴抽出能力を、手元の小さなデータの課題に流用する手法です。少ないデータでも過学習を避けて高い精度を得やすくなります。",
    modules: [6],
  },
];

/** id を必ず持つ形に正規化し、英語名で整列した用語一覧。 */
export const glossary: GlossaryTerm[] = rawTerms
  .map((t) => ({ ...t, id: t.id ?? toSlug(t.en) }))
  .sort((a, b) => a.en.localeCompare(b.en));

export default glossary;
