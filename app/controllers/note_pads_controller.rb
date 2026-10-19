class NotePadsController < ApplicationController
  before_action :set_note_pad, only: %i[show update destroy]

  def index
    @note_pads = NotePad.ordered
  end

  def show
  end

  # "+ NEW" creates a blank pad and drops you straight into it
  def create
    @note_pad = NotePad.create!
    redirect_to @note_pad
  end

  # called by the note-pad Stimulus controller's debounced autosave
  def update
    if @note_pad.update(note_pad_params)
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to @note_pad }
      end
    else
      head :unprocessable_entity
    end
  end

  def destroy
    @note_pad.destroy
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to note_pads_path, status: :see_other }
    end
  end

  private

  def set_note_pad
    @note_pad = NotePad.find(params[:id])
  end

  def note_pad_params
    params.require(:note_pad).permit(:title, :body)
  end
end
