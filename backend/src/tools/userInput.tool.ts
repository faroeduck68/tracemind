import { TraceMindTool } from '../types/tool'

const userInputTool: TraceMindTool = {
  name: 'user_input',
  displayName: '用户输入',
  async run(context) {
    return {
      success: true,
      output: {
        query: context.query ?? '',
        files: context.files,
        acceptedAt: new Date().toISOString()
      },
      message: '用户需求已接收'
    }
  }
}

export default userInputTool
