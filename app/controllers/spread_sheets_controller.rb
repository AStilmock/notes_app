class SpreadSheetsController < ApplicationController
  before_action :set_spread_sheet, only: %i[show update destroy]

  rescue_from JSON::ParserError, with: -> { head :unprocessable_entity }

  def index
    @spread_sheets = Current.user.spread_sheets.ordered
  end

  def show
  end

  # "NEW" creates a blank 3x3 sheet and drops you straight into it
  def create
    @spread_sheet = Current.user.spread_sheets.create!
    redirect_to @spread_sheet
  end

  # called by the spread-sheet Stimulus controller's debounced autosave
  def update
    if @spread_sheet.update(spread_sheet_params)
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to @spread_sheet }
      end
    else
      head :unprocessable_entity
    end
  end

  def destroy
    @spread_sheet.destroy
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to spread_sheets_path, status: :see_other }
    end
  end

  private

  # scoped to the signed-in user, so another user's sheet is a 404
  def set_spread_sheet
    @spread_sheet = Current.user.spread_sheets.find(params[:id])
  end

  # the grid and its column widths / row heights each arrive as one JSON string,
  # so nested arrays (and nulls) survive form encoding intact
  JSON_FIELDS = %i[cells col_widths row_heights].freeze

  def spread_sheet_params
    params.require(:spread_sheet).permit(:title, *JSON_FIELDS).tap do |attrs|
      JSON_FIELDS.each { |field| attrs[field] = JSON.parse(attrs[field]) if attrs.key?(field) }
    end
  end
end
