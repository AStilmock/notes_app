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

  # the grid arrives as one JSON string (an array of rows) so it survives form encoding intact
  def spread_sheet_params
    params.require(:spread_sheet).permit(:title, :cells).tap do |attrs|
      attrs[:cells] = JSON.parse(attrs[:cells]) if attrs.key?(:cells)
    end
  end
end
