import type { Catalog } from '..'
import type en from '../en'
import common from './common'
import format from './format'
import locale from './locale'
import errors from './errors'
import emails from './emails'
import labels from './labels'
import documents from './documents'
import files from './files'
import actions from './actions'
import preview from './preview'
import details from './details'
import activity from './activity'
import search from './search'
import tags from './tags'
import uploads from './uploads'
import home from './home'
import views from './views'
import nav from './nav'
import dialogs from './dialogs'
import share from './share'
import people from './people'
import settings from './settings'
import auth from './auth'
import invite from './invite'
import publicPage from './publicPage'
import oauth from './oauth'

export default {
  common,
  format,
  locale,
  errors,
  emails,
  labels,
  documents,
  files,
  actions,
  preview,
  details,
  activity,
  search,
  tags,
  uploads,
  home,
  views,
  nav,
  dialogs,
  share,
  people,
  settings,
  auth,
  invite,
  publicPage,
  oauth,
} satisfies Catalog<typeof en>
